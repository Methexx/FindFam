# 11 — Known Limitations

Honest list of gaps as of Sprint 6 (code-only hardening pass). Kept up to date
rather than pretending scope gaps don't exist — see `docs/10-production-readiness.md`'s
Documentation & Handoff section for why this matters.

## Dependency audit (`npm audit`)

As of this pass, `npm audit --workspaces` reports 48 findings (1 critical,
16 high, 31 moderate). **All of them are transitive**, tracing to exactly
three packages, none of which are our own code:

- **`@sentry/nextjs`** (admin-web) — pulls in an OpenTelemetry/rollup
  dependency tree with several known advisories. Fixed upstream in
  `@sentry/nextjs@10`, a major bump not yet taken (installed: `8.55.2`).
- **`firebase-admin`** (backend, used for FCM push in the SOS path) — pulls
  in an outdated `uuid` via its Google Cloud client dependencies. Fixed
  upstream in `firebase-admin@14`, a major bump not yet taken.
- **Next.js's bundled PostCSS** — an incomplete-fix advisory around
  `sourceMappingURL` handling when `from` is unset. Fixed in `next@16`, a
  major bump not yet taken (installed: `14.2.x`).

None of these were addressed in this pass because `npm audit fix --force`
would take all three as breaking major-version bumps simultaneously, and
`firebase-admin` in particular touches the SOS push-notification path — a
safety-critical path per `docs/10-production-readiness.md`'s Realtime &
Safety-Critical section — which deserves its own dedicated test cycle
against real devices, not a same-pass swap alongside unrelated hardening
work. Each of these three upgrades should be its own follow-up: apply,
run the full backend test suite (65 tests) and a manual SOS-push smoke
test for `firebase-admin`, `flutter analyze`/`flutter test` are unaffected
(that's a JS/TS-only finding), and a full `admin-web` build + manual
click-through for `next`/`@sentry/nextjs`.

## `flutter pub outdated`

27 mobile dependencies are behind by a major version (e.g. `flutter_riverpod`
2.x → 3.x available, `go_router` 14 → 17 available). This is normal
`pub outdated` drift, not a security scanner finding — Dart/Flutter has no
direct equivalent of `npm audit`. Two transitive packages are flagged
discontinued (`flutter_secure_storage_macos`, `js`) but still functional;
worth revisiting if their replacement packages stabilize.

## Feature gaps

- **Crash detection**: not implemented. Evaluated and deliberately deferred
  per the original feature research (liability/effort tradeoff) — see
  `docs/09-sprint-timeline.md`'s Tier 3 notes.
- **FCM device-token registration**: `Firebase.initializeApp()` runs on
  mobile, but nothing yet calls `getToken()` and registers it with the
  backend. Deferred since Sprint 4/5 — pushes currently rely on whatever
  registration path exists from earlier setup, not a dedicated endpoint.
- **Single-region deployment**: no multi-region or failover story; not
  needed at current scale, worth revisiting if usage grows.
- **No live deployment yet**: `render.yaml`, the Dockerfiles, and
  `.github/workflows/keep-alive.yml` exist and are configured, but nothing
  is actually deployed to Render/Supabase/Upstash/Vercel as of this pass —
  deploying them is an infra/account-creation step, not a code change.

## Data retention

`locations` table retention policy is not yet decided — see
`docs/02-database-schema.md`'s Retention Notes and `PRIVACY.md`. This needs
a decision before a wider launch, not just before Tier 2 history features.

## JWT rotation

No automated secret-rotation mechanism exists; `JWT_SECRET`/`ADMIN_JWT_SECRET`
are static values from env. See `docs/06-auth-flow.md` for the rotation
tradeoff writeup (rotating invalidates all live access tokens — low blast
radius given the 15-minute token lifetime, but still requires a coordinated
refresh-token strategy or forced re-login, not yet built).
