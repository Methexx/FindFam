# 09 — Sprint Timeline

## Format
6 sprints × 2 weeks = 12 weeks, solo/part-time. Sprints 0–6 are complete and recorded below as a status table rather than a plan. Sprints 7–9 are the work that actually remains, in the same **Feature work / DevOps / Checkpoint** format the original plan used.

This document was rewritten after a full codebase audit. The point of the rewrite is that the original version described only what was intended — it had no way to say which checkpoints were met and which were not. One was not.

---

## Delivered — Sprints 0–6

| Sprint | Intended | What actually landed | Checkpoint |
|---|---|---|---|
| **0** | Monorepo & environment bootstrap | Turborepo + npm workspaces, `apps/{backend,admin-web,mobile}`, `packages/{shared-types,config}`, `infra/docker-compose.yml` (PostGIS 16-3.4 + Redis 7), both Dockerfiles, `.env.example` files | ✅ Met |
| **1** | Auth everywhere | `modules/auth/` (register/login/refresh/logout/me), argon2id, opaque SHA-256-hashed refresh tokens, migrations 001–003, admin-web login with httpOnly cookie, mobile auth + `ApiClient` refresh interceptor, `backend-ci.yml`, Sentry | ✅ Met |
| **2** | Circles & follows | `modules/follows/` + `modules/circles/`, migrations 004–006, mobile circles/follows screens, admin-web circle list, `admin-web-ci.yml` | ✅ Met |
| **3** | Live location + realtime | `realtime/` (WS gateway, Redis pub/sub, location channel), `modules/locations/` with PostGIS geography + GIST index (migration 007), mobile `ws_client.dart` + background capture + `flutter_map` live map, `mobile-ci.yml` | ✅ Met |
| **4** | Chat + emergency contacts + SOS | `modules/messages/`, `modules/emergency-contacts/`, `modules/sos/` with a 30s dedup window, BullMQ `sos-delivery` queue + worker, `lib/fcm.ts`, migrations 008–011, mobile chat/SOS/contacts, admin-web SOS live feed over WS | ❌ **Not met** — see below |
| **5** | Admin moderation + Tier 1 | Admin user search/suspend/unsuspend + audit log + analytics summary, `modules/geofences/`, sharing-status endpoint, migrations 012–014, mobile profile + sharing toggle + persistent indicator, `keep-alive.yml` | ⚠️ Partial — geofences have no mobile UI |
| **6** | Hardening & production readiness | Sentry on all three apps, CORS lockdown, WS `location:update` rate limiting, `PRIVACY.md` + in-app privacy screen, `docs/11-known-limitations.md`, design systems for mobile and admin-web, 65 backend integration tests | ⚠️ Partial — **nothing is deployed** |

### Sprint 4's checkpoint was never met

The checkpoint was *"a real SOS trigger delivering an FCM push notification."* It has never passed, and the reason is a single missing write:

- Migration `008` creates `users.fcm_token`.
- `auth.repository.ts` → `findFcmTokenForUser` **reads** it.
- **Nothing writes it.** `patchMeBodySchema` accepts only `avatarUrl` and `phone`. On mobile, `firebase_messaging` is a declared dependency with zero imports — `getToken()` is never called.

So `sendPushToUser` always takes its `No FCM token registered` branch, and **all three push paths — SOS fan-out, chat offline delivery, geofence-enter alerts — are silent no-ops.** `sendPushToToken` never rethrows, so the failure leaves no trace. Everything around the push works: the queue enqueues, the worker runs, the retry/backoff is correct. The delivery step at the end does nothing.

This is why Sprint 7 leads with it. It is the only unmet MVP checkpoint, and it sits on the safety-critical path.

---

## Sprint 7 — Push Delivery & Safety Correctness
**Goal:** make the safety-critical path actually deliver, and close the defects that leak location or crash the client.

**Feature work:**
- **FCM token registration, backend.** No migration needed — `users.fcm_token` already exists. Extend `PATCH /auth/me` rather than adding a route: add `fcmToken` to `patchMeBodySchema`, widen `updateUser`'s `Partial<Pick<UsersTable, …>>` to include `'fcm_token'`, map it in `updateMe`. Keep `fcm_token` out of `toPublicUser` — it must not come back down in the response. While there, confirm Kysely's `.set()` drops undefined optional fields rather than writing `NULL`; that risk already exists on `avatarUrl`/`phone` and a third field makes it easier to hit.
- **FCM token registration, mobile.** New `lib/core/notifications/push_service.dart`: permission request, `getToken()`, and an `onTokenRefresh` listener. Register through the existing `AuthRepository` → `ApiClient` path so the refresh interceptor is reused. Call it after successful `login`, `register` and `restoreSession`.
- **`POST_NOTIFICATIONS`** in `AndroidManifest.xml` plus the runtime request — without it nothing displays on Android 13+ regardless of token state.
- **Logout teardown.** `logout()` and `forceLogout()` must call `wsClient.disconnect()`, `disableSharing()` and clear `LocationCache`. Today sign-out leaves GPS streaming and the Android foreground "you are sharing" notification on screen — a privacy defect in a location app, not a cosmetic one. `LocationCache` is a `static final instance`, so one user's last-known positions currently survive into the next session.
- **`SosNotifier` crash.** `(… as AuthAuthenticated?)?.user.id` throws when the state is `AuthUnauthenticated` — casting a non-null instance to a non-matching nullable type is an error, not a null. It is called unguarded from `_onWsMessage`, so an SOS broadcast arriving during or after logout kills the stream listener. Use the `is AuthAuthenticated ? … : null` form already used in `circle_map_screen.dart`.
- **iOS graceful degrade.** `Firebase.initializeApp` is called unconditionally and `firebase_options.dart` throws `UnsupportedError` for iOS, so an iOS build cannot start. iOS is out of scope; guard the call so it degrades instead of crashing.
- **SOS alert stacking** — one `showDialog` per event inside a `ref.listen` loop stacks unbounded full-screen barriers, and `_shownAlertIds` is never pruned on resolve, so a re-triggered SOS won't re-alert.
- **Unawaited `postLocation()`** in the offline REST fallback — it throws `ApiException`, so every failure becomes an unhandled async error. The notifier also never cancels its `updates.listen` subscription.

**DevOps:**
- **Fix two latent deploy blockers now, not during the go-live window.** `SENTRY_DSN` is declared `z.string()` with no default and `envSchema.parse()` runs at module load, but `render.yaml` deliberately omits the key — the backend will throw before Fastify starts and crash-loop, and `/health` will never pass. Give it `.default('')`, matching how mobile already treats an empty DSN as a valid no-op. Separately, `ALLOWED_ORIGINS` is never declared in `render.yaml` and defaults to `http://localhost:3001`, which will CORS-block the deployed admin-web.
- **Dead config, while touching env.** `JWT_REFRESH_SECRET` is a *required* env var that no application code reads — refresh tokens are `randomBytes(32)` stored as a SHA-256 hash. Drop it from `env.ts`, `vitest.config.ts`, both `.env*.example` files and `render.yaml`. Delete `src/plugins/rate-limit.ts` (a 2-line stub whose stale TODO describes work already done in `lib/rate-limit-config.ts`), `lib/config/theme.dart`, `lib/core/location/motion_detector.dart`, and the pubspec dependencies with zero imports.

**Verification:**
- `npm run migrate:test:up && npm test --workspace=@findfam/backend` — the 65 existing tests stay green, plus new coverage for `PATCH /auth/me { fcmToken }` and a worker-level test asserting `findFcmTokenForUser` now resolves.
- `cd apps/mobile && flutter analyze && flutter test`.
- **The manual test that matters:** two real Android devices, each registered as the other's emergency contact. Trigger an SOS from device A with the app **cold-killed** on device B, and confirm the push arrives. This check has never once passed.
- Manual: sign out, and confirm the foreground sharing notification disappears and GPS stops.

**Checkpoint:** an SOS triggered on a real Android device delivers an FCM push to an emergency contact's cold-killed device — Sprint 4's checkpoint, finally met. Signing out actually stops sharing.

---

## Sprint 8 — Feature Completion & Client Correctness
**Goal:** close the last unmet feature from the original plan, and the correctness defects that would show up in a demo.

**Feature work:**
- **Mobile geofences** — the last unmet Sprint 5 item. New `lib/features/geofences/` following the `data/ · domain/ · ui/ · viewmodel/` shape every other feature uses. Client work only: the backend module is complete (`POST`/`GET /circles/:id/geofences`, `DELETE /geofences/:id`), and `geofence:event` is already computed and broadcast server-side on every location update.
- **Usernames instead of raw UUIDs.** The follows list renders `'Request from {followerId}'` and the map renders `userId` as a member's name. Neither DTO carries a username, so this is a backend change (follows list, `GET /circles/:id/locations/latest`) followed by the two UI sites.
- **Client lifecycle fixes.** `User.isSharing` is parsed and then never used, so after a restart the toggle reads OFF while the server, other members and the admin dashboard all still report sharing ON. `ChatNotifier.loadMore` captures state before its `await` and overwrites after, dropping broadcasts that arrive mid-fetch; its documented "REST retry if the WS send didn't land" doesn't exist. Circle delete pops without invalidating `circlesNotifierProvider`. And `wsClient.onReconnected` is a single global callback slot assigned in `initState` and never cleared — a second map clobbers the first, and navigating away leaves a closure holding a disposed notifier. Converting it to a listener list is the fix that scales; clearing it in `dispose` is the minimum.

**Backend:**
- Migration `015`: GIST index on `geofences.center` — it is queried by `ST_DWithin` on **every** location POST and has no spatial index today — plus a btree on `circles.owner_id`.
- Graceful shutdown: SIGTERM closes the worker and the Fastify app but leaks `redisPubSub`'s two connections, the BullMQ queue connection and the pg `Pool`.
- WS heartbeat, and re-resolve circle subscriptions on join — they are resolved once at auth time, so joining a circle mid-session receives nothing until reconnect.
- Refresh-path hardening: check `suspended_at` in `refresh()`, authenticate `POST /auth/logout`.

**Contract & admin-web:**
- Make the backend actually import `@findfam/shared-types` — it declares the dependency and imports it zero times, so admin-web `as`-casts backend JSON with no compile-time contract. Add the missing shapes: the `{ data, error }` envelope, `AnalyticsSummary`, `ListUsersResult`, and the admin WS message types.
- A single `lib/api-client.ts` replacing the base-URL fallback duplicated across 8 files, each swallowing errors into an empty state. Real token validation in `middleware.ts` instead of a cookie-presence check. A logout route, 401 handling, and users-list pagination using the `nextCursor` the backend already returns.

**Verification:**
- `npm test --workspace=@findfam/backend`, `flutter analyze && flutter test`, `npm run build --workspace=@findfam/admin-web`.
- Manual: create a geofence, cross its boundary, confirm the alert fires on the device and the event reaches the map.
- Manual: let an admin token expire and confirm admin-web redirects to login rather than rendering silently empty tables.

**Checkpoint:** every feature in the original 6-sprint plan is present on the client; no raw UUIDs in the UI; session expiry behaves correctly in admin-web.

---

## Sprint 9 — Go Live
**Goal:** the thing that has never happened. As of this rewrite, nothing is deployed anywhere.

`render.yaml`, both Dockerfiles and `keep-alive.yml` exist and are configured, but no service runs outside `docker-compose`. Tasks 1 (Supabase), 2 (Upstash) and 6 (re-verify Sprint 3 on the new stack) of `docs/claude-code-pre-sprint4-infra-migration-prompt.md` are unstarted.

**DevOps:**
- Provision Supabase, run all migrations against it, and **verify rather than assume** that PostGIS is enabled and that the GIST index on `locations.geom` actually created — the migration prompt flags this specifically.
- Provision Upstash and point `realtime/redis-pubsub.ts` and BullMQ at its **TLS/TCP endpoint, not the REST API** — pub/sub and BullMQ both need a persistent connection.
- Deploy the backend to Render. Confirm `wss://` survives their proxy, and characterise the free-tier cold start against the WS client's existing exponential backoff.
- Fix `infra/Dockerfile.admin-web` before using it: it copies both `/repo/node_modules` and `/repo/apps/admin-web/node_modules` into the same `./node_modules`, and declares no build-time `ARG`/`ENV` for `NEXT_PUBLIC_*`, so it would ship the `localhost:3000` fallback baked in. Then deploy admin-web.
- Add a CD workflow — CI is PR-only today, with no `push: main` run — and make migrations run as part of deploy rather than by hand, which is what `docs/10-production-readiness.md` already claims happens.
- Set the `BACKEND_HEALTH_URL` secret so `keep-alive.yml` stops being a no-op. Add external uptime monitoring, and Sentry **alert rules** rather than passive logging.
- Add vitest and a first set of tests to admin-web — the only app with no test tooling at all.

**Verification:**
- Re-run the Sprint 3 and Sprint 4 checkpoints against the **deployed** stack, not locally: cross-circle isolation, WS reconnection across a Render cold start, REST fallback with the WS deliberately killed, rate limiting, and PostGIS queries on Supabase.
- Walk `docs/10-production-readiness.md` top to bottom and check boxes **only where genuinely true**.

**Checkpoint:** production-deployed backend, admin-web and database, with doc 10's launch gate — Security, Privacy & Legal, and Realtime & Safety-Critical, all three complete — honestly satisfied.

---

## Deferred — explicitly not doing

Decisions, not omissions. Each with its reason.

| Item | Reason |
|---|---|
| iOS support | Needs a Mac and an Apple Developer account. Android-only was chosen deliberately; Sprint 7 only stops the crash. |
| `go_router` migration | The 10 imperative `Navigator.push` sites work. A router earns its place when deep links do. |
| Motion-adaptive location sampling | Sprint 3's stretch goal. Fixed 10s/20m sampling is adequate until battery data says otherwise. |
| Dependency major bumps (`@sentry/nextjs` 10, `firebase-admin` 14, `next` 16) | All 48 audit findings are transitive. `firebase-admin` sits on the SOS push path and deserves its own test cycle, not a bundled `--force`. |
| Refresh-token rotation + reuse detection | Tokens are already revocable server-side, which is what doc 10 requires. Rotation is a hardening upgrade, not a gate. |
| Distributed rate-limit / dedup store | Correct on one Render instance. Revisit when there are two. |
| admin-web charts, user-detail, SOS-detail, audit-log pages | The backend endpoints exist and stay unused. Tables are sufficient for a moderation tool at this scale. |
| `locations` retention job | Needs a policy decision (see `PRIVACY.md`) before it needs code. |
| Crash detection, Tier 2/3 features | Traction-gated by the original plan. |

---

## Beyond Sprint 9 — Tier 2 / Tier 3 (open-ended, post-MVP)
Unchanged from the original plan: traction-gated, built once there are real users rather than on a fixed calendar.
- Tier 2: location history + playback, Footprints personal place map, expressive chat, temporary share links
- Tier 3 (optional): driving reports, silent SOS variants, crash detection — evaluate case-by-case given the liability/effort tradeoffs flagged in the feature research

## Notes on This Timeline
- **Sprint 3 was correctly identified as the highest-risk sprint, and it delivered.** The realtime layer landed complete — WS gateway, Redis pub/sub, three channels, reconnection with backoff — and the tests around it are the strongest in the repo. The risk showed up somewhere the original plan didn't anticipate: **Sprint 4's last mile.** Everything expensive about push notifications (queue, worker, retry, fan-out) was built; the one cheap step at the end — writing the device token — was never wired, and because `sendPushToToken` swallows its errors, nothing surfaced the gap for two sprints.
- The lesson worth carrying into Sprints 7–9: **a checkpoint phrased as "delivers a push notification" has to be tested on a real device to count.** Every layer beneath it passed its own tests.
- DevOps was threaded through every sprint as intended, and that mostly worked — CI exists for all three apps from the sprint that introduced them. The exception is deployment itself, which was deferred sprint after sprint and is now the whole of Sprint 9. Deferring a deploy is how `SENTRY_DSN` became a boot-crash nobody could have noticed.
