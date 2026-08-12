# 10 — Production Readiness

## Purpose
Final checklist before FindFam is considered launch-ready. Organized by category.

**How to read the boxes.** A box is ticked only when it has been *verified* — in code that was opened, or in a test that was run. Several items are half-done; those stay unticked with a note saying what is missing and which sprint closes it, because a box ticked on vibes makes the whole checklist worthless. Remaining work is scheduled in `docs/09-sprint-timeline.md` (Sprints 7–9); every known gap is listed in `docs/11-known-limitations.md`.

Status as of the post-Sprint-6 audit.

---

## Security

- [ ] All secrets (`JWT_SECRET`, `ADMIN_JWT_SECRET`, `FCM_SERVICE_ACCOUNT_JSON`, `DATABASE_URL`, `DATABASE_MIGRATIONS_URL`, `REDIS_URL`, `SENTRY_DSN`) stored in platform secret managers (Render/Vercel env vars), never committed to the repo — *blocked: nothing is deployed yet (Sprint 9). `render.yaml` declares the keys; no values exist anywhere but local `.env`.*
- [x] `.env.example` files present and up to date; real `.env` files gitignored — *`JWT_REFRESH_SECRET` is still listed and is dead config; removed in Sprint 7.*
- [x] User and admin JWT secrets are different values (per 06-auth-flow) — *`JWT_SECRET` vs `ADMIN_JWT_SECRET`, with tests asserting rejection in both directions.*
- [x] Passwords hashed with argon2id or bcrypt (sufficient cost factor), never logged — *`lib/password.ts`, argon2id, used for both users and admins.*
- [x] Rate limiting active on: `/auth/login` (10/min), `/auth/register` (5/min), `POST /locations` (30/min), `location:update` (WS, 30/60s per connection) — *`POST /sos` is deliberately unlimited; it uses a 30s dedup window instead, because rate-limiting a panic button is the wrong trade.*
- [x] Admin JWT stored as httpOnly secure cookie, not localStorage — *set with `sameSite=lax`, `secure` in prod, 8h maxAge. But `/api/admin/ws-token` hands the same token to client JS for the WS handshake, which undoes this under XSS; replaced with a 60-second `aud: 'ws'` token in Sprint 9.*
- [ ] `npm audit` / `flutter pub outdated` run and high-severity issues addressed — *run, not addressed. All 48 findings are transitive across three packages; see doc 11 for why they were deliberately deferred and in what order.*
- [x] CORS configured to only allow known origins (admin-web domain, not `*`) — *`ALLOWED_ORIGINS`, comma-split, passed to `@fastify/cors`. Note it defaults to `http://localhost:3001` and is **not declared in `render.yaml`**, so it must be set at deploy time or the deployed dashboard is blocked.*
- [ ] Refresh tokens revocable server-side; "logout of all sessions" tested — *revocation works (`deleteRefreshTokensForUser`, invoked on suspend), but there is no user-facing "log out everywhere" route and no test for it.*
- [x] SQL queries parameterized (no string-concatenated queries — applies especially to any raw PostGIS queries) — *Kysely throughout; the three raw PostGIS fragments use Kysely's `sql` tagged template, so interpolations bind rather than concatenate.*

## Privacy & Legal

- [ ] Privacy policy published and linked in-app (mobile) and on admin/marketing site — *mobile is done (`privacy_policy_screen.dart` + `PRIVACY.md`); there is no admin/marketing site to link it from.*
- [x] Explicit statement: FindFam does not sell user location data — *`PRIVACY.md`: "We do not sell your location data, or any other user data, to anyone."*
- [x] In-app disclaimer on the SOS feature: **"This is not a substitute for calling emergency services"** — shown at first use of the SOS button, not buried in settings — *in the confirm dialog in `sos_button.dart`, so it appears at the point of use every time, and again in the privacy screen.*
- [x] Consent-first onboarding confirmed: no way to enable location sharing on someone else's behalf without their own login — *sharing is per-user, gated on both the user's own toggle and an OS permission grant on their own device. There is no admin or circle-owner override.*
- [ ] Data retention policy decided for `locations` table (see 02-database-schema retention notes) and documented — *blocked on a product decision, not on code.*
- [ ] If launching where users may be minors: age-appropriate consent flow reviewed

## DevOps / Infrastructure

- [x] CI pipelines green for all three apps (`backend-ci.yml`, `admin-web-ci.yml`, `mobile-ci.yml`) — *all three exist and run on PRs. Note they are PR-only: there is no `push: main` trigger.*
- [ ] CD auto-deploys staging on merge to a `develop`/staging branch, production on merge to `main` — *no CD workflow exists at all (Sprint 9).*
- [ ] Docker images build reproducibly (`docker-compose up` works from a clean clone) — *not verified from a clean clone this pass. `infra/Dockerfile.admin-web` is broken and referenced by nothing; Sprint 9 deletes it.*
- [ ] Database migrations run automatically as part of deploy, not manually — *currently manual, which this document previously claimed otherwise (Sprint 9).*
- [ ] Separate FCM test/prod setup if possible
- [x] Health-check endpoint (`/health`) returns meaningful status (DB reachable, Redis reachable) — *parallel `SELECT 1` and `redis.ping()`; 200 `ok` or 503 `degraded` with per-dependency detail.*
- [ ] Uptime monitoring configured (external ping service) with alerts to email/Slack/Discord
- [ ] Scheduled GitHub Actions workflow pings `/health` every 3 days to prevent Supabase's free-tier 7-day inactivity pause — *`keep-alive.yml` exists on a 3-day cron but exits early: the `BACKEND_HEALTH_URL` secret is unset and there is nothing to ping.*
- [ ] Render free-tier cold-start behavior (30–60s after 15 min idle) tested and accepted as a known limitation — *measure it and record the number here rather than ticking the box.*
- [ ] Sentry configured on backend, admin-web, and mobile — with alert rules, not just passive logging — *configured on all three; **no alert rules**, which is the half that matters. Source-map upload is also deliberately disabled on admin-web.*

## Realtime & Safety-Critical Paths

- [ ] SOS trigger tested with WS connection deliberately killed — REST fallback confirmed working (per 07-data-flow) — *the code path exists and is correct; never exercised on a device.*
- [ ] SOS delivery (FCM push to emergency contacts) tested against real devices, not just mocks — **this has never worked.** *`users.fcm_token` is read but never written, so every push is a silent no-op. Sprint 7's entire purpose; see doc 11.*
- [x] Duplicate SOS triggers within a short window are deduplicated, not creating multiple events/notifications — *30-second dedup window, with a test asserting a rapid duplicate returns the existing event.*
- [ ] WebSocket reconnection tested under real conditions: airplane mode toggle, app backgrounding, network switch (WiFi ↔ cellular) — *covered by unit tests against a real loopback WS server (drop → auto-reconnect → `onReconnected`), which is not the same as the real conditions this box asks for.*
- [ ] Location updates degrade gracefully with no GPS signal (indoors, tunnels) — app doesn't crash or spam invalid coordinates

## Mobile-Specific

- [ ] Background location permission flow tested on both iOS and Android with the pre-permission explanation screen (per 08-flutter-app-structure) — *iOS is out of scope and currently cannot launch. On Android the pre-permission screen exists, but `ACCESS_BACKGROUND_LOCATION` is declared without the settings-redirect flow needed to actually obtain it.*
- [ ] Foreground service notification (Android) displays correctly and matches the "you are sharing" transparency requirement — *configured in `location_service.dart`; not verified on a device. Note it currently persists after logout — fixed in Sprint 7.*
- [ ] Battery impact benchmarked over a real day of use — *needs a week of real usage; schedule once closed testing starts.*
- [ ] App tested with location permission denied/revoked mid-use — graceful degradation, not a crash
- [ ] Push notifications tested with app killed (not just backgrounded) — SOS and chat notifications must work from a cold-killed state — *see the SOS delivery item above; blocked on the same gap.*

## Admin Web

- [x] Admin login isolated from user auth, confirmed a leaked user token cannot access admin routes — *separate secrets and separate decorators, with tests in both directions: a user token on an admin route and an admin token on a user route.*
- [ ] SOS live feed tested with a real trigger to confirm end-to-end latency is acceptable
- [x] Moderation actions (suspend/unsuspend) actually take effect — suspended user's active sessions are terminated, not just flagged in the DB — *three layers: `forceDisconnectUser` closes the live WS with code 4001, refresh tokens are deleted, and `authenticate` re-checks `suspended_at` on every request so the next REST call 403s rather than waiting out the 15-minute token. Covered by `admin-suspend-disconnect.test.ts`.*
- [x] Basic audit trail exists for moderation actions (who suspended whom, when) — *`admin_audit_log`, written on suspend/unsuspend, readable via `GET /admin/users/:id`. No admin-web page renders it yet.*

## Performance

- [ ] Database indexes in place per 02-database-schema (GIST on `locations.geom`, btree on hot query paths) — *`locations.geom` has its GIST index and the hot btrees exist, but `geofences.center` has **none** despite `ST_DWithin` running against it on every location POST. Migration 015 in Sprint 8.*
- [ ] `locations` table growth rate estimated — confirm retention/partitioning plan is actually scheduled — *blocked on the retention decision above.*
- [ ] Load-tested WS gateway with a realistic number of simulated concurrent connections — *deliberately deferred: meaningless below a real concurrent-user count. Revisit when closed testing gives one.*

## Documentation & Handoff (portfolio value)

- [ ] All 12 reference docs (00–11) up to date with what was actually built, not just what was planned — *09, 10 and 11 were brought current in the post-Sprint-6 audit. 02, 03, 05, 06 and 08 need updates as Sprints 7–9 land; the per-sprint doc list is in 09.*
- [x] README in repo root pointing to this doc set — *links all 12 docs.*
- [ ] Demo video or screenshots prepared for portfolio/CV use
- [x] Known limitations documented honestly — *`docs/11-known-limitations.md`, rewritten after the audit; it now leads with the fact that push notifications have never worked, rather than softening it.*

---

## Launch Gate
Do not consider FindFam production-ready until every item in **Security**, **Privacy & Legal**, and **Realtime & Safety-Critical Paths** is checked — these three sections cover the categories where a gap isn't just a bug, it's a trust or safety failure, which is the opposite of FindFam's entire positioning against Life360.

**Current gate status: 11 of 21 gate items met** — Security 7/10, Privacy & Legal 3/6, Realtime & Safety-Critical 1/5.

The weakness is not evenly spread. Security is in good shape because it was built in rather than retrofitted. Realtime & Safety-Critical is 1 of 5, and the reason is a single defect: FCM push delivery has never functioned, which directly blocks two of the five and two more items under Mobile. That one gap is why Sprint 7 exists and why it comes first.
