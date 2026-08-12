# 11 — Known Limitations

Honest list of gaps, updated after a full codebase audit following the Sprint 6
hardening pass. Kept current rather than pretending scope gaps don't exist — see
`docs/10-production-readiness.md`'s Documentation & Handoff section for why this
matters. Remaining work is scheduled in `docs/09-sprint-timeline.md` (Sprints 7–9
close out the original plan; Sprints 10–12 add the consumer web surface).

## Push notifications do not work — at all

This is the most serious gap in the project, and it invalidates Sprint 4's
checkpoint.

`users.fcm_token` is created by migration 008 and read by
`auth.repository.ts` → `findFcmTokenForUser`. **Nothing ever writes it.**
`patchMeBodySchema` accepts only `avatarUrl` and `phone`; on mobile,
`firebase_messaging` is a declared dependency with zero imports, so
`getToken()` is never called.

Consequently `sendPushToUser` always takes its `No FCM token registered`
branch, and **every push path is a silent no-op**: SOS delivery to emergency
contacts, chat messages to offline members, and geofence-enter alerts. The
surrounding machinery is complete and correct — BullMQ enqueues, the worker
runs, retry and backoff work, the fan-out resolves contacts. Only the final
delivery step does nothing.

It stayed hidden for two sprints because `sendPushToToken` deliberately never
rethrows (correctly — one dead token must not block an SOS fan-out) and logs
only to `console.warn`. Sprint 7 closes the write path and adds Sentry
reporting so the next failure is visible.

Related, and fixed in the same sprint:
- Android does not declare `POST_NOTIFICATIONS`, mandatory on Android 13+, and
  declares no high-importance notification channel — so even a delivered SOS
  push would land in Android's default channel.
- Once tokens are stored, **logout must clear them.** Otherwise the next person
  to sign in on that phone receives the previous user's SOS alerts.

## Suspending a user does not stop them logging back in

`admin.service.ts` → `suspendUser` does the hard parts correctly: it sets
`suspended_at`, deletes every refresh token for that user via
`deleteRefreshTokensForUser`, and calls `forceDisconnectUser` to drop their live
WebSocket. So the *current* session really does end.

But **neither `login()` nor `refresh()` in `auth.service.ts` ever reads
`suspended_at`.** `login` checks that the user exists and the password verifies,
then issues a fresh token pair. So a suspended user types their password again
and is back in, with a new 7-day refresh token, seconds later.

Suspension is therefore a revoked session, not a disabled account — which is not
what the admin dashboard's "Suspended" badge implies to the moderator who clicked
it. `docs/09-sprint-timeline.md` Sprint 8 flagged the missing check in `refresh()`;
the `login()` half is the larger one and both are scheduled in Sprint 10, before
the web app becomes a second front door. The fix should return 403 rather than
401 so a client can distinguish "wrong password" from "account suspended".

## Nothing is deployed

`render.yaml`, `infra/Dockerfile.backend` and `.github/workflows/keep-alive.yml`
exist and are configured, but no service runs outside local `docker-compose`.
Tasks 1 (Supabase), 2 (Upstash) and 6 (re-verify Sprint 3 on the new stack) of
`docs/claude-code-pre-sprint4-infra-migration-prompt.md` are unstarted.

Two latent deploy blockers were found during the audit. Neither would surface
until the first deploy failed:

- **`SENTRY_DSN` is a required env var that `render.yaml` deliberately omits.**
  `env.ts` declares it `z.string()` with no default, and `envSchema.parse()`
  runs at module load — so the process throws before Fastify starts, the
  container crash-loops, and the `/health` check never passes.
- **`ALLOWED_ORIGINS` is never declared in `render.yaml`** and defaults to
  `http://localhost:3001`, which would CORS-block the deployed admin-web.

Also: `keep-alive.yml` is inert until the `BACKEND_HEALTH_URL` secret is set,
CI is PR-only with no `push: main` run and no CD workflow at all, and migrations
are run by hand — which contradicts doc 10's "migrations run automatically as
part of deploy".

`infra/Dockerfile.admin-web` is referenced by nothing and is broken twice over
(it copies two `node_modules` trees onto the same path, and declares no
build-time `ARG`/`ENV` for `NEXT_PUBLIC_*`, which Next inlines at build time —
so it would ship `localhost:3000` baked in). Sprint 9 deletes it rather than
repairing it; admin-web deploys to Vercel, which builds natively.

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

- **WebSocket circle subscriptions are resolved once, at auth time.** A user who
  joins a circle mid-session receives nothing from it until they reconnect.
- **No ping/pong heartbeat or idle timeout.** This becomes urgent before
  deployment: Render's proxy drops idle sockets silently, and the client's
  exponential backoff will present that as a permanent "Offline".
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
- **Geofences have no mobile UI.** The backend module is complete — three routes,
  containment checks, `geofence:event` broadcast — and `apps/mobile/lib/features/`
  has no `geofences/` directory at all. This is the last unmet feature from the
  original 6-sprint plan; Sprint 8 closes it.
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
