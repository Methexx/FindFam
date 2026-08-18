# 11 — Known Limitations

Honest list of gaps, kept current as each sprint closes items rather than
pretending scope gaps don't exist — see `docs/10-production-readiness.md`'s
Documentation & Handoff section for why this matters. Updated through
Sprint 9's code changes (Part B — actual provisioning — is separate and not
yet started). Remaining work is scheduled in `docs/09-sprint-timeline.md`
(Sprints 7–9 close out the original plan; Sprints 10–12 add the consumer web
surface).

## Push notifications — fixed in Sprint 7

Previously the most serious gap in the project, invalidating Sprint 4's
checkpoint: `users.fcm_token` was read but never written, so every push path
(SOS, chat, geofence alerts) was a silent no-op.

Fixed in Sprint 7: `PUT`/`DELETE /auth/fcm-token` register and clear the
device token, `push_service.dart` registers on sign-in and clears on
sign-out, device handoff (a second user signing in on the same phone nulls
the first user's token) is covered by a backend test, and `sendPushToToken`
now reports to Sentry and self-heals a dead token instead of silently
swallowing the failure. Android's missing `POST_NOTIFICATIONS` permission and
high-importance notification channel were fixed in the same sprint.

Manually verified per `docs/09-sprint-timeline.md` Sprint 7: an SOS triggered
on a real Android device delivered an FCM push to an emergency contact's
cold-killed device — Sprint 4's checkpoint, met.

## Suspending a user — fixed in Sprint 8

Previously: `admin.service.ts` → `suspendUser` correctly set `suspended_at`,
deleted refresh tokens, and force-disconnected the live WebSocket, but
neither `login()` nor `refresh()` in `auth.service.ts` checked `suspended_at`
— so a suspended user could type their password again and get a fresh token
pair seconds later.

Fixed in Sprint 8: both `login()` and `refresh()` now check `suspended_at`
and return 403 (distinguishing "account suspended" from "wrong credentials"),
mirroring the identical check already proven in `plugins/auth.ts` for
already-issued tokens. Covered by a backend test asserting both endpoints
reject a suspended account.

## Nothing is deployed

`render.yaml`, `infra/Dockerfile.backend` and `.github/workflows/keep-alive.yml`
exist and are configured, but no service runs outside local `docker-compose`.
Tasks 1 (Supabase), 2 (Upstash) and 6 (re-verify Sprint 3 on the new stack) of
`docs/claude-code-pre-sprint4-infra-migration-prompt.md` are unstarted.

One latent deploy blocker was found during the audit and fixed in Sprint 7:
`SENTRY_DSN` was a required env var that `render.yaml` deliberately omitted
(`env.ts` declared it `z.string()` with no default, so the process would have
thrown before Fastify started and crash-looped). `env.ts` now defaults it to
`''`, which `@sentry/node` treats as a disabled SDK — no longer a blocker.

**`ALLOWED_ORIGINS` is never declared in `render.yaml`** and defaults to
`http://localhost:3001`, which would CORS-block the deployed admin-web. Still
open — must be set to admin-web's real deployed origin when the Render
service is created.

Also: `keep-alive.yml` is inert until the `BACKEND_HEALTH_URL` secret is set,
CI is PR-only with no `push: main` run and no CD workflow at all, and migrations
are run by hand — which contradicts doc 10's "migrations run automatically as
part of deploy". Sprint 9 adds a migration-on-push workflow to close this.

`infra/Dockerfile.admin-web` was referenced by nothing and was broken twice
over (it copied two `node_modules` trees onto the same path, and declared no
build-time `ARG`/`ENV` for `NEXT_PUBLIC_*`, which Next inlines at build time —
so it would have shipped `localhost:3000` baked in). Deleted in Sprint 9 rather
than repaired; admin-web deploys to Vercel, which builds natively.

`/api/admin/ws-token` handed the full 8h admin session cookie to client JS
just to open the SOS-feed WS connection, defeating the httpOnly cookie
everywhere else in admin-web. Fixed in Sprint 9: the backend mints a
60-second, `aud: 'ws'`-scoped token instead, which the WS gateway requires and
every REST route now rejects.

## Single-instance assumptions

Correct today on one Render instance, silently wrong on two. Documented rather
than engineered around, because the free tier is single-instance:

- The `@fastify/rate-limit` store is in-memory, so limits are per-process.
- `lastUpdateAtByUser` and `lastGeofenceIdsByUserAndCircle` in
  `locations.service.ts` are in-process maps, so SOS dedup and geofence
  transition diffing would drift across instances.
- One FCM token per user (`users.fcm_token` is a single column). A `device_tokens`
  table is the upgrade path when a tester carries two phones.

## Realtime gaps

- **~~WebSocket circle subscriptions are resolved once, at auth time~~ — fixed
  in Sprint 8.** A new `circles:resync` WS message re-runs the subscribe loop;
  mobile calls it after joining/creating a circle mid-session, mirroring the
  existing `onReconnected` reconcile pattern.
- **~~No ping/pong heartbeat or idle timeout~~ — fixed in Sprint 8.**
  `ws-gateway.ts` now pings every 30s and terminates a connection that misses
  a pong, so Render's silent idle-socket drop surfaces as a real `close`
  event that triggers the client's existing exponential backoff, instead of
  presenting as a permanent "Offline".
- **Geofences fire on enter only** — there is no exit event.
- **`sos_events.status = 'cancelled'` is unreachable.** The column allows it; no
  route sets it.

## Platform and feature gaps

- **iOS is out of scope, and currently cannot launch at all.**
  `Firebase.initializeApp` is called unconditionally in `main.dart` while
  `firebase_options.dart` throws `UnsupportedError` for `TargetPlatform.iOS`, and
  there is no `GoogleService-Info.plist`. Sprint 7 makes this degrade gracefully
  instead of crashing; actual iOS support needs a Mac and an Apple Developer
  account and is not planned.
- **~~Geofences have no mobile UI~~ — fixed in Sprint 8.** New
  `apps/mobile/lib/features/geofences/` (create/list/delete + live enter
  alerts via the same `geofence:event` broadcast), closing the last unmet
  feature from the original 6-sprint plan.
- **Crash detection**: not implemented. Evaluated and deliberately deferred per
  the original feature research (liability/effort tradeoff) — see
  `docs/09-sprint-timeline.md`'s Tier 3 notes.
- **Firebase init can fail on some real Android devices**, surfacing as
  `PlatformException(channel-error, ...)`. Ruled out as a config mismatch —
  `applicationId`, `google-services.json`'s `package_name`, and
  `firebase_options.dart`'s `appId` are all verified consistent. The remaining
  causes are device-specific and not fixable in code: outdated/unreachable
  Google Play Services on that device, or the build's signing-key SHA-1 not
  being registered against the app in the Firebase console. Already
  non-blocking — `main.dart` catches it, times out at 10s, and reports to
  Sentry — but on an affected device push notifications (Sprint 7) won't work
  until the underlying device/console issue is resolved.
- **Tier 1 partially met**: "pause/ghost mode" is only the binary sharing switch,
  and "time at place" is absent.
- **Single-region deployment**: no multi-region or failover story; not needed at
  current scale.

## Client-side defects found in the audit

Scheduled across Sprints 7 and 8, listed here so the record is complete:

- Signing out does not stop location sharing — `logout()` clears tokens but never
  disconnects the WebSocket or stops `LocationService`, so GPS keeps streaming and
  the Android foreground "you are sharing" notification stays on screen. A privacy
  defect in a location app.
- `SosNotifier` throws a `TypeError` when unauthenticated (an `as` cast where an
  `is` check is needed), killing the stream listener if an SOS broadcast arrives
  during or after logout.
- `User.isSharing` is parsed and never used, so after a restart the profile toggle
  reads OFF while the server and every other client still report sharing ON.
- Chat's `loadMore` drops broadcasts that arrive mid-fetch, and its documented
  "REST retry if the WS send didn't land" does not exist.
- The map and follows screens render raw UUIDs where usernames belong — the
  backend DTOs don't carry a username yet.
- `wsClient.onReconnected` is a single global callback slot, so a second circle map
  clobbers the first and navigating away leaves a closure holding a disposed
  notifier.

## Web app

There is no consumer web surface today. `apps/admin-web`'s entire route surface
is `/` (a public landing page), `/login` (admin only) and `/dashboard/*`
(moderation) — a user cannot sign in on the web at all. `docs/09-sprint-timeline.md`
Sprints 10–12 add one; the limitations below are the state that work starts from,
and the first two are prerequisites for it rather than merely adjacent.

Two things that will still be true after the consumer surface lands, and should
not be mistaken for bugs once it does:

- **Browser location sharing only works while the tab is open.**
  `navigator.geolocation` has no background mode, and there is no web equivalent
  of the Android foreground service in `core/location/location_service.dart`.
  The Background Sync and Periodic Background Sync APIs do not provide location.
  The web sharing indicator must say "while this tab is open" rather than
  implying the phone's coverage — an indicator that overstates what it is doing
  is the same class of defect as sign-out-keeps-sharing, pointed the other way.
- **The web will not have an SOS trigger.** Deliberate, recorded in doc 09's
  Deferred table: receiving and resolving SOS events on the web is useful, but a
  browser tab is not the device in your pocket during an emergency.

### admin-web as it stands

- **No tests and no test tooling** — the only app without a `test` script.
- No shared API client: the base-URL fallback is duplicated across 8 files and
  every error is swallowed into an empty state.
- `middleware.ts` checks cookie *presence*, not validity. It is not a security
  boundary and cannot be one — admin-web does not hold `ADMIN_JWT_SECRET`. Real
  authorization is the backend's 401.
- `/api/admin/ws-token` hands a full 8-hour admin JWT to client JS, defeating the
  httpOnly cookie. Sprint 9 replaces it with a 60-second `aud: 'ws'` token.
- No logout route, no 401 handling, no users-list pagination despite the backend
  returning `nextCursor`. No user-detail, SOS-detail or audit-log pages, though
  the backend endpoints and shared types for all three exist.

## Dead configuration

- **`JWT_REFRESH_SECRET` is a required env var that no application code reads.**
  Refresh tokens are `randomBytes(32)` stored as a SHA-256 hash. It appears only
  in `env.ts`, `vitest.config.ts`, the `.env*.example` files and `render.yaml`.
- `src/plugins/rate-limit.ts` is a 2-line stub whose stale TODO describes work
  already done in `lib/rate-limit-config.ts`.
- `lib/config/theme.dart` (superseded by `lib/core/theme/`) and
  `lib/core/location/motion_detector.dart` (an unreferenced stub — Sprint 3's
  motion-adaptive sampling was never implemented).
- Mobile dependencies with zero imports: `go_router` (there is no router; all
  navigation is imperative `Navigator.push`), `permission_handler`, `fake_async`.
- The backend declares `@findfam/shared-types` and imports it zero times, so
  admin-web `as`-casts backend JSON with no compile-time contract.
- `tsconfig.json`'s `"include": ["src"]` means `test/` and `scripts/` are never
  type-checked.

## Dependency audit (`npm audit`)

`npm audit --workspaces` reports 48 findings (1 critical, 16 high, 31 moderate).
**All of them are transitive**, tracing to exactly three packages, none of which
are our own code:

- **`@sentry/nextjs`** (admin-web) — pulls in an OpenTelemetry/rollup dependency
  tree with several known advisories. Fixed upstream in `@sentry/nextjs@10`, a
  major bump not yet taken (installed: `8.55.2`).
- **`firebase-admin`** (backend, used for FCM push in the SOS path) — pulls in an
  outdated `uuid` via its Google Cloud client dependencies. Fixed upstream in
  `firebase-admin@14`, a major bump not yet taken.
- **Next.js's bundled PostCSS** — an incomplete-fix advisory around
  `sourceMappingURL` handling when `from` is unset. Fixed in `next@16`, a major
  bump not yet taken (installed: `14.2.x`).

None were addressed because `npm audit fix --force` would take all three as
breaking major-version bumps simultaneously, and `firebase-admin` in particular
touches the SOS push path — a safety-critical path per doc 10 — which deserves
its own test cycle against real devices. Each should be its own follow-up:
apply, run the full backend test suite and a manual SOS-push smoke test for
`firebase-admin`; a full `admin-web` build plus manual click-through for `next`
and `@sentry/nextjs`. `flutter analyze`/`flutter test` are unaffected — this is
a JS/TS-only finding.

Note the ordering constraint: the `firebase-admin` bump should wait until
Sprint 7 has established a **working** push baseline to regress against.
Upgrading a dependency on a path that has never functioned proves nothing.

## `flutter pub outdated`

27 mobile dependencies are behind by a major version (e.g. `flutter_riverpod`
2.x → 3.x, `go_router` 14 → 17). This is normal `pub outdated` drift, not a
security scanner finding — Dart/Flutter has no direct equivalent of `npm audit`.
Two transitive packages are flagged discontinued (`flutter_secure_storage_macos`,
`js`) but still functional.

## Data retention

`locations` table retention policy is not yet decided — see
`docs/02-database-schema.md`'s Retention Notes and `PRIVACY.md`. This needs a
decision before a wider launch, not just before Tier 2 history features. It is
blocked on a product decision, not on code.

## JWT rotation

No automated secret-rotation mechanism exists; `JWT_SECRET`/`ADMIN_JWT_SECRET`
are static values from env. See `docs/06-auth-flow.md` for the rotation tradeoff
writeup (rotating invalidates all live access tokens — low blast radius given the
15-minute token lifetime, but still requires a coordinated refresh-token strategy
or forced re-login, not yet built).

Separately, refresh tokens do not rotate on use and there is no reuse detection,
so a leaked refresh token stays valid for its full 7 days. Tokens *are* revocable
server-side, which is what doc 10 requires. Rotation is deferred, and note it
cannot ship server-only: `api_client.dart` persists only the `accessToken` from a
refresh response, so rotating without the matching mobile change would force-log-out
every user at their first token expiry.
