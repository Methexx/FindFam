# 06 — Auth Flow

## Two Separate Auth Systems
FindFam deliberately runs **two isolated auth systems** rather than one with roles:
1. **User auth** — regular app users (mobile), stored in `users` table
2. **Admin auth** — admin dashboard only, stored in a separate `admins` table

This is intentional, not an oversight — a regular user account should never be escalatable to admin, and an admin credential leak should never expose live-sharing user accounts. Separate tables, separate JWT secrets, separate token issuers.

## User Auth Flow

### Registration
1. Mobile app collects: username, email, phone, password
2. `POST /auth/register` — server validates username uniqueness (case-insensitive), hashes password (argon2), creates `users` row
3. Server issues access token (short-lived, 15 min) + refresh token (7 days), returned to client
4. Client stores both in `flutter_secure_storage` (never plain SharedPreferences — this is location-sensitive data)

### Login
1. `POST /auth/login` with username/email + password
2. Server verifies password hash, issues new access + refresh token pair
3. Refresh token stored server-side (hashed) in a `refresh_tokens` table for revocation support — a bare JWT refresh token with no server-side record can't be revoked if a device is lost

### Silent Refresh
1. Access token expires after 15 minutes
2. Client detects 401, calls `POST /auth/refresh` with the stored refresh token
3. Server validates refresh token against the hashed record, issues a new access token
4. If refresh token is invalid/expired/revoked → force full re-login

### Logout
1. `POST /auth/logout` — server deletes the refresh token record server-side
2. Client clears secure storage
3. **"Logout of all sessions"** (useful if a device is lost) — delete all refresh token records for that user

### Token Contents
```
Access token payload: { sub: userId, username, iat, exp }
Refresh token payload: { sub: userId, tokenId, iat, exp }
```
Keep the access token payload minimal — no circle memberships or roles embedded, since those can change and a stale token shouldn't carry stale permissions. Circle membership is checked server-side on each request via the `circle_members` table, not trusted from the token.

## Admin Auth Flow
1. `POST /admin/auth/login` — separate endpoint, separate `admins` table, separate password hash
2. Issues an admin-scoped JWT signed with `ADMIN_JWT_SECRET` (different secret from user tokens — a stolen user token must never verify against admin routes and vice versa)
3. Admin routes protected by a dedicated Fastify plugin (`admin-auth.ts`) that only accepts admin-signed tokens
4. No self-registration for admin accounts — first admin seeded directly in the database (same pattern used in School Connect), additional admins created manually, not via public API

## WebSocket Auth
- WS connections authenticate via an initial `auth` message containing the access token (not a query param, to avoid tokens leaking into server logs/proxies)
- Server verifies the token the same way as REST requests before allowing any subscription
- Admin WS connections (subscribing to `admin:sos`) use the admin token and are verified against the admin secret

## Password & Security Notes
- Passwords hashed with **argon2id** (preferred) or bcrypt with a sufficient cost factor — never store or log plaintext
- Rate-limit login attempts per username + per IP to slow brute force
- Forgot-password flow: email-based OTP (consistent with your School Connect pattern) rather than a reset link, to avoid link-hijacking concerns
- Consider requiring **phone verification** at registration if SMS/Twilio is already integrated for SOS — a verified phone number is exactly what the SOS SMS fallback depends on, so verifying it early avoids silent failures later

## Session Model Summary
| Token | Lifetime | Storage | Revocable |
|---|---|---|---|
| User access token | 15 min | Client memory / secure storage | No (short-lived, not worth tracking) |
| User refresh token | 7 days | Client secure storage + server (hashed) | Yes |
| Admin token | 8 hours (shorter — admin sessions shouldn't linger) | Browser (httpOnly cookie, not localStorage) | Yes (server-side session table) |

## Admin Token Storage Note
Store the admin JWT in an **httpOnly, secure cookie**, not localStorage — the admin dashboard is a web app and is more exposed to XSS than the mobile app; httpOnly cookies prevent token theft via injected scripts.

## JWT Secret Rotation (not yet automated)
`JWT_SECRET` and `ADMIN_JWT_SECRET` are static values from env — no rotation
mechanism exists as of Sprint 6. If a secret needs rotating (suspected leak,
routine hygiene), the tradeoff is:

- Rotating `JWT_SECRET` invalidates every currently-issued **access token**
  immediately. Given the 15-minute lifetime, blast radius is low — affected
  users just need a silent refresh (which uses the *refresh* token, a
  separate secret/table, unaffected by an access-token secret rotation) or,
  worst case, a re-login.
- Rotating `JWT_REFRESH_SECRET` invalidates all refresh tokens, forcing
  every user to log in again — a harder cutover, since there's no "reissue
  refresh tokens under the new secret" migration path today. Treat this as
  a forced-logout-everyone event, not a silent rotation.
- Rotating `ADMIN_JWT_SECRET` forces every admin to log in again — acceptable
  given admin sessions are already short (8 hours) and low in number.

No automated rotation schedule or dual-secret grace-period support is built.
If this becomes a real requirement, the standard pattern is accepting both
the old and new secret for verification during a grace window, signing only
with the new one — not implemented here.
