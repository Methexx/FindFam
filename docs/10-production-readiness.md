# 10 — Production Readiness

## Purpose
Final checklist before FamShare is considered launch-ready. Organized by category; run through this at the end of Sprint 6 (per 09-sprint-timeline).

---

## Security

- [ ] All secrets (`JWT_SECRET`, `ADMIN_JWT_SECRET`, `FCM_SERVICE_ACCOUNT_JSON`, `DATABASE_URL`, `REDIS_URL`) stored in platform secret managers (Render/Vercel env vars), never committed to the repo
- [ ] `.env.example` files present and up to date; real `.env` files gitignored
- [ ] User and admin JWT secrets are different values (per 06-auth-flow)
- [ ] Passwords hashed with argon2id or bcrypt (sufficient cost factor), never logged
- [ ] Rate limiting active on: `/auth/login`, `/auth/register`, `POST /locations`, `location:update` (WS)
- [ ] Admin JWT stored as httpOnly secure cookie, not localStorage
- [ ] `npm audit` / `flutter pub outdated` run and high-severity issues addressed
- [ ] CORS configured to only allow known origins (admin-web domain, not `*`)
- [ ] Refresh tokens revocable server-side; "logout of all sessions" tested
- [ ] SQL queries parameterized (no string-concatenated queries — applies especially to any raw PostGIS queries)

## Privacy & Legal

- [ ] Privacy policy published and linked in-app (mobile) and on admin/marketing site
- [ ] Explicit statement: FamShare does not sell user location data (this is a core differentiator per your feature research — make sure it's actually true in practice, not just stated)
- [ ] In-app disclaimer on the SOS feature: **"This is not a substitute for calling emergency services"** — shown at first use of the SOS button, not buried in settings
- [ ] Consent-first onboarding confirmed: no way to enable location sharing on someone else's behalf without their own login
- [ ] Data retention policy decided for `locations` table (see 02-database-schema retention notes) and documented
- [ ] If launching where users may be minors: age-appropriate consent flow reviewed (families are your target market — this matters)

## DevOps / Infrastructure

- [ ] CI pipelines green for all three apps (`backend-ci.yml`, `admin-web-ci.yml`, `mobile-ci.yml`)
- [ ] CD auto-deploys staging on merge to a `develop`/staging branch, production on merge to `main` (or manual promote — either is fine, but the process is defined and documented)
- [ ] Docker images build reproducibly (`docker-compose up` works from a clean clone)
- [ ] Database migrations run automatically as part of deploy, not manually
- [ ] Separate FCM test/prod setup if possible (avoids test SOS triggers pushing to real devices unexpectedly)
- [ ] Health-check endpoint (`/health`) returns meaningful status (DB reachable, Redis reachable)
- [ ] Uptime monitoring configured (external ping service) with alerts to email/Slack/Discord
- [ ] Scheduled GitHub Actions workflow pings `/health` at least every 5–6 days to prevent Supabase's free-tier 7-day inactivity pause
- [ ] Render free-tier cold-start behavior (30–60s after 15 min idle) tested and accepted as a known limitation for the closed-testing group
- [ ] Sentry configured on backend, admin-web, and mobile — with alert rules, not just passive logging

## Realtime & Safety-Critical Paths

- [ ] SOS trigger tested with WS connection deliberately killed — REST fallback confirmed working (per 07-data-flow)
- [ ] SOS delivery (FCM push to emergency contacts) tested against real devices, not just mocks
- [ ] Duplicate SOS triggers within a short window are deduplicated, not creating multiple events/notifications
- [ ] WebSocket reconnection tested under real conditions: airplane mode toggle, app backgrounding, network switch (WiFi ↔ cellular)
- [ ] Location updates degrade gracefully with no GPS signal (indoors, tunnels) — app doesn't crash or spam invalid coordinates

## Mobile-Specific

- [ ] Background location permission flow tested on both iOS and Android with the pre-permission explanation screen (per 08-flutter-app-structure)
- [ ] Foreground service notification (Android) displays correctly and matches the "you are sharing" transparency requirement
- [ ] Battery impact benchmarked over a real day of use — target referenced in your feature research is keeping it well under Life360's own ~10%/day figure
- [ ] App tested with location permission denied/revoked mid-use — graceful degradation, not a crash
- [ ] Push notifications tested with app killed (not just backgrounded) — SOS and chat notifications must work from a cold-killed state

## Admin Web

- [ ] Admin login isolated from user auth, confirmed a leaked user token cannot access admin routes
- [ ] SOS live feed tested with a real trigger to confirm end-to-end latency is acceptable
- [ ] Moderation actions (suspend/unsuspend) actually take effect — suspended user's active sessions are terminated, not just flagged in the DB
- [ ] Basic audit trail exists for moderation actions (who suspended whom, when)

## Performance

- [ ] Database indexes in place per 02-database-schema (GIST on `locations.geom`, btree on hot query paths)
- [ ] `locations` table growth rate estimated — confirm retention/partitioning plan is actually scheduled, not just documented
- [ ] Load-tested WS gateway with a realistic number of simulated concurrent connections for your expected initial user count

## Documentation & Handoff (portfolio value)

- [ ] All 11 reference docs (00–10) up to date with what was actually built, not just what was planned
- [ ] README in repo root pointing to this doc set
- [ ] Demo video or screenshots prepared for portfolio/CV use
- [ ] Known limitations documented honestly (e.g., "crash detection not implemented," "single-region deployment") — this reads better in an interview than pretending scope gaps don't exist

---

## Launch Gate
Do not consider FamShare production-ready until every item in **Security**, **Privacy & Legal**, and **Realtime & Safety-Critical Paths** is checked — these three sections cover the categories where a gap isn't just a bug, it's a trust or safety failure, which is the opposite of FamShare's entire positioning against Life360.
