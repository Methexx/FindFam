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

## Unplanned work, delivered

Work that landed outside the sprint structure — recorded here so this document stays a record of what actually happened, not only of what was scheduled. Most of it was reactive: two of these were hard blockers that made the app impossible to build or run at all.

| Work | Why it happened |
|---|---|
| **Android build fix** — `sentry_flutter` 8.14.2 pins `languageVersion = "1.6"` in its own `android/build.gradle`, which the project's Kotlin 2.2.20 compiler rejects outright. Raised the language/API floor to 1.8 for any subproject requesting less. | `flutter run` and `flutter build` both failed on `:sentry_flutter:compileDebugKotlin`. Nothing could be built or tested until this was fixed. |
| **Black screen on real devices** — `main.dart` awaited `Firebase.initializeApp()` before `runApp()`. If that hangs or throws on a physical device (restrictive network, pending Play Services update, unregistered signing key) the app never rendered a frame and showed Android's black launch window with no crash and no error. Firebase now initializes in the background with a timeout. | The app installed and launched on a physical device but displayed nothing. |
| **admin-web landing page at `/`** — the route was a bare redirect to `/login`, so a visitor met a password box with no explanation. Replaced with a public page tracing the architecture and three end-to-end journeys with real endpoints and payloads. | Requested. Also makes the deployed URL meaningful for Sprint 9. |
| **admin-web monolithic dark theme** — the design system defined dark tokens but nothing ever applied the `.dark` class, so the site always rendered light. Collapsed to a single `:root` palette. | Requested. |
| **Circle map redesign** — proper avatar-ring markers with staleness fading, auto-fit to all members via `CameraFit.coordinates` (it previously centred on an arbitrary member), tap-for-detail sheet, and a `displayName` fallback replacing raw UUIDs in the member list. | Requested. |

**Two sprint items were closed as side effects of the above**, and should not be worked again:
- **Sprint 7's iOS graceful-degrade** — the `Firebase.initializeApp` try/catch added for the black-screen fix also catches the `UnsupportedError` that `firebase_options.dart` throws on iOS. iOS no longer hard-crashes at launch. It remains out of scope as a supported platform.
- **The mobile half of Sprint 8's "usernames instead of raw UUIDs"** — `MemberLocation.displayName` now prefers a `username` and falls back to a short `Member 3f2a` label. It parses the field defensively, so real names will appear the moment the backend sends them. **The backend half is still outstanding**, so the map still shows fallback labels today.

---

## Sprint 7 — Push Delivery & Safety Correctness
**Goal:** make the safety-critical path actually deliver, and close the defects that leak location or crash the client.

**Feature work:**
- **FCM token registration, backend.** No new migration — `users.fcm_token` already exists from 008. But a **dedicated route pair, `PUT` and `DELETE /auth/fcm-token`**, both behind `fastify.authenticate` with `rateLimitConfig` — *not* an extra field on `PATCH /auth/me`. Three reasons, in order of weight:
  1. **Logout must delete the token, and that is a safety requirement, not a nicety.** Leave it set and the next person to sign in on that phone receives the previous user's SOS alerts. `DELETE` has exactly one meaning; expressing deletion through `PATCH` needs `nullable().optional()` plus a `updateUser` that distinguishes absent from explicit-null — and `updateUser` **already gets this wrong**, spreading `{avatar_url: undefined, phone: undefined}` straight into Kysely's `.set()`. Building the token path on a known-broken partial-update helper is how you get a token that silently never clears.
  2. **Lifecycle mismatch.** `onTokenRefresh` fires on OS reinstall, app-data clear, or Google-side rotation — never in response to a user editing their profile. Routing it through `/auth/me` makes a background housekeeping call return a full user DTO that mobile must then discard or let clobber `AuthAuthenticated.user`, coupling a platform-channel callback to the auth state machine that two of the P0 bugs below are already about.
  3. Registration runs on every cold start; a profile edit is rare. Different rate-limit profiles are only expressible as different routes.
  - **Device handoff:** registration must first null the token on any *other* user holding it — one `UPDATE users SET fcm_token = NULL WHERE fcm_token = $1 AND id <> $2`. Without it, A logs out ungracefully, B signs in on the same phone, and A's next SOS pushes to B.
  - Fix `updateUser` to strip undefined keys while in the file — the latent partial-update bug stands on its own.
  - Keep `fcm_token` out of `toPublicUser`; it must never come back down in a response.
- **Make push failure visible.** `sendPushToToken` must keep never throwing at the fan-out boundary — one dead token must not block the rest of an SOS fan-out, and the comment saying so is correct. But it should report to Sentry and self-heal: on `messaging/registration-token-not-registered` or `messaging/invalid-argument`, clear the stored token. Silent failure for two sprints is the reason this gap survived.
- **FCM token registration, mobile.** New `lib/core/push/push_service.dart`: permission request, `getToken()`, an `onTokenRefresh` listener, and a top-level `@pragma('vm:entry-point')` background handler registered before `runApp`. Drive it from a single app-wide `ref.listen(authNotifierProvider, …)` in `app.dart` that registers on transition into `AuthAuthenticated` — deliberately **not** inside `AuthNotifier`, so platform channels stay out of the auth state machine and the existing widget tests keep passing without a Firebase mock. The `DELETE` on logout must happen inside `AuthRepository.logout()` **before** `secureStorage.clear()`, since it needs a valid access token; `forceLogout()` can only do the local half, which is worth a comment.
- **Android notification setup.** `POST_NOTIFICATIONS` in `AndroidManifest.xml` plus the runtime request — without it nothing displays on Android 13+ regardless of token state. Then declare `com.google.firebase.messaging.default_notification_channel_id` **and actually create that channel at `IMPORTANCE_HIGH` in `MainActivity.kt`**. Declaring it alone is not enough: if the channel doesn't exist, Android auto-creates it at `IMPORTANCE_DEFAULT`, so the SOS push arrives and is logged but never raises a heads-up banner — a failure that looks exactly like the checkpoint passing. Ship the manifest entry and the Kotlin creation in the same commit, because a channel's importance is immutable once created and any install in between keeps the quiet one until reinstall.
- **Logout teardown.** `logout()` and `forceLogout()` must call `wsClient.disconnect()`, `disableSharing()` and clear `LocationCache`. Today sign-out leaves GPS streaming and the Android foreground "you are sharing" notification on screen — a privacy defect in a location app, not a cosmetic one. `LocationCache` is a `static final instance`, so one user's last-known positions currently survive into the next session.
- **`SosNotifier` crash.** `(… as AuthAuthenticated?)?.user.id` throws when the state is `AuthUnauthenticated` — casting a non-null instance to a non-matching nullable type is an error, not a null. It is called unguarded from `_onWsMessage`, so an SOS broadcast arriving during or after logout kills the stream listener. Use the `is AuthAuthenticated ? … : null` form already used in `circle_map_screen.dart`.
- ~~**iOS graceful degrade.**~~ **Already done** — closed as a side effect of the black-screen fix; see "Unplanned work, delivered" above. `Firebase.initializeApp` is now wrapped, so the `UnsupportedError` iOS throws no longer prevents launch.
- **SOS alert stacking** — one `showDialog` per event inside a `ref.listen` loop stacks unbounded full-screen barriers, and `_shownAlertIds` is never pruned on resolve, so a re-triggered SOS won't re-alert.
- **Unawaited `postLocation()`** in the offline REST fallback — it throws `ApiException`, so every failure becomes an unhandled async error. The notifier also never cancels its `updates.listen` subscription.

**DevOps:**
- **Fix two latent deploy blockers now, not during the go-live window.** `SENTRY_DSN` is declared `z.string()` with no default and `envSchema.parse()` runs at module load, but `render.yaml` deliberately omits the key — the backend will throw before Fastify starts and crash-loop, and `/health` will never pass. Give it `.default('')`, matching how mobile already treats an empty DSN as a valid no-op. Separately, `ALLOWED_ORIGINS` is never declared in `render.yaml` and defaults to `http://localhost:3001`, which will CORS-block the deployed admin-web.
- **Dead config, while touching env.** `JWT_REFRESH_SECRET` is a *required* env var that no application code reads — refresh tokens are `randomBytes(32)` stored as a SHA-256 hash. Drop it from `env.ts`, `vitest.config.ts`, both `.env*.example` files and `render.yaml`. Delete `src/plugins/rate-limit.ts` (a 2-line stub whose stale TODO describes work already done in `lib/rate-limit-config.ts`), `lib/config/theme.dart`, `lib/core/location/motion_detector.dart`, and the pubspec dependencies with zero imports.

**Verification:**
- `npm run migrate:test:up && npm test --workspace=@findfam/backend` — the 65 existing tests stay green, plus new coverage for `PUT`/`DELETE /auth/fcm-token` (including the device-handoff case, which is the safety test of the sprint) and an assertion that `findFcmTokenForUser` now resolves. `PATCH /auth/me` gets a separate regression test proving a single-field patch no longer wipes the other field.
- `cd apps/mobile && flutter analyze && flutter test`.
- **The manual test that matters, and it needs no deployment.** The push travels backend → Google FCM → device, so only token registration needs to reach the backend. Run it locally against two real Android devices, overriding the emulator-only defaults in `config/env.dart`:
  ```
  flutter run --dart-define=API_BASE_URL=http://<LAN-IP>:3000/api/v1 \
              --dart-define=WS_URL=ws://<LAN-IP>:3000
  ```
  1. Register users A and B; B adds A as an emergency contact.
  2. Confirm `SELECT id, fcm_token FROM users` is non-null for both. If it's null, everything below is theatre.
  3. **Kill** A's app from the recents switcher — not backgrounded, killed. Trigger SOS from B. A's device shows the push. That is doc 10's "tested with app killed", and it has never once passed.
  4. Repeat with B in airplane mode at the moment of trigger, then restored — exercises the REST fallback in `SosNotifier.trigger()`.
  5. Sign out on A: the foreground sharing notification disappears, GPS stops, `fcm_token` is NULL in the DB, and a subsequent SOS from B produces **no** push to A.

**Checkpoint:** an SOS triggered on a real Android device delivers an FCM push to an emergency contact's cold-killed device — Sprint 4's checkpoint, finally met. Signing out actually stops sharing.

---

## Sprint 8 — Feature Completion & Client Correctness
**Goal:** close the last unmet feature from the original plan, and the correctness defects that would show up in a demo.

**Feature work:**
- **Mobile geofences** — the last unmet Sprint 5 item. New `lib/features/geofences/` following the `data/ · domain/ · ui/ · viewmodel/` shape every other feature uses. Client work only: the backend module is complete (`POST`/`GET /circles/:id/geofences`, `DELETE /geofences/:id`), and `geofence:event` is already computed and broadcast server-side on every location update.
- **Usernames instead of raw UUIDs — backend half only; the map client is already done.** `MemberLocation.displayName` now prefers a `username` and falls back to `Member 3f2a`, parsing the field defensively, so the map starts showing real names the moment the backend sends them with no further client change. What remains: neither DTO carries a username yet. Add it to `GET /circles/:id/locations/latest` and the follows list — `location:broadcast` flows through the same `toPublicLocation`, so one change fixes the map label **and** the live broadcast. The follows list still renders `'Request from {followerId}'` raw and needs both halves. Reuse the `innerJoin('users', …)` + explicit select-columns pattern already proven in `admin.repository.ts`. Purely additive, so existing assertions keep passing.
- **Client lifecycle fixes.** `User.isSharing` is parsed and then never used, so after a restart the toggle reads OFF while the server, other members and the admin dashboard all still report sharing ON. `ChatNotifier.loadMore` captures state before its `await` and overwrites after, dropping broadcasts that arrive mid-fetch; its documented "REST retry if the WS send didn't land" doesn't exist. Circle delete pops without invalidating `circlesNotifierProvider`. And `wsClient.onReconnected` is a single global callback slot assigned in `initState` and never cleared — a second map clobbers the first, and navigating away leaves a closure holding a disposed notifier. Converting it to a listener list is the fix that scales; clearing it in `dispose` is the minimum.

**Backend:**
- Migration `015`: GIST index on `geofences.center` — it is queried by `ST_DWithin` on **every** location POST and has no spatial index today — plus a btree on `circles.owner_id`. Prove it with `EXPLAIN ANALYZE` before and after; the point is an index scan replacing a seq scan, not that the migration ran.
- Graceful shutdown: SIGTERM closes the worker and the Fastify app but leaks `redisPubSub`'s two connections, the BullMQ queue connection and the pg `Pool`. Note `redisPubSub.close()` **already exists** — `server.ts` simply never calls it, so that part is one line. Add a `setTimeout(…, 10_000).unref()` fallback so a hung close doesn't blow Render's SIGTERM window.
- WS heartbeat, and re-resolve circle subscriptions on join — they are resolved once at auth time, so joining a circle mid-session receives nothing until reconnect. The heartbeat is **not optional before Sprint 9**: Render's proxy drops idle sockets silently, and the client's exponential backoff will paper over that as a permanent "Offline".
- Refresh-path hardening: check `suspended_at` in `refresh()`, authenticate `POST /auth/logout`. **If rotation is ever added** (it is deferred — see below), it must ship in the same commit as the mobile side: `api_client.dart` persists only `accessToken` from the refresh response, and `SecureStorage` exposes `saveAccessToken` and a both-tokens `saveTokens` but no refresh-only setter. Rotating server-side without that change force-logs-out every user at their first token expiry.

**Contract & admin-web:**
- Make the backend actually import `@findfam/shared-types` — it declares the dependency and imports it zero times, so admin-web `as`-casts backend JSON with no compile-time contract. Add the missing shapes: the `{ data, error }` envelope, `AnalyticsSummary`, `ListUsersResult`, and the admin WS message types, then import them at the DTO boundaries admin-web actually consumes so drift becomes a compile error. Scope this tightly — the envelope plus those four shapes is the whole win; typing all 43 routes is not.
- Type-check `test/` and `scripts/`, which `tsconfig.json`'s `"include": ["src"]` excludes today. Add a separate `tsconfig.typecheck.json` with `noEmit` and a `typecheck` script rather than widening `include` — widening it would emit the test files into `dist`.
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
- **Delete `infra/Dockerfile.admin-web` rather than fix it.** It is referenced by nothing and broken twice over: it copies both `/repo/node_modules` and `/repo/apps/admin-web/node_modules` into the same `./node_modules` (the second wins), and it declares no build-time `ARG`/`ENV` for `NEXT_PUBLIC_*`, which Next inlines at build time — so any image it produced would have `localhost:3000` baked in as the API URL. admin-web goes to Vercel, which builds it natively. A broken Dockerfile nobody uses is a trap for future-you; record the deletion in doc 11.
- **Fix `/api/admin/ws-token`.** It currently hands the full 8-hour admin JWT to client JS, which defeats the httpOnly cookie the surrounding code is proud of. Add a backend `POST /admin/auth/ws-token` minting a 60-second token with `aud: 'ws'`, have the `admin_auth` branch in `ws-gateway.ts` check `aud`, and make the admin-web route proxy that instead. Roughly 30 lines of backend, 5 of admin-web, and it closes a doc 10 Security item.
- **`middleware.ts` is not a security boundary and the code should say so.** Decoding the JWT `exp` claim for a cheap expiry redirect is worth doing, but admin-web does not have — and should not have — `ADMIN_JWT_SECRET`. Real authorization is the backend's 401 plus the new API client's redirect. Pretending middleware authorizes is worse than a comment admitting it doesn't.
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
| Refresh-token rotation + reuse detection | Tokens are already revocable server-side, which is what doc 10 requires. Rotation is a hardening upgrade, not a gate — and it cannot ship server-only (see the `api_client.dart` coupling in Sprint 8), so it wants its own slot rather than a corner of one. |
| Multi-device push (a `device_tokens` table) | One token per user is correct for a closed-testing group. `users.fcm_token` is a single column by design; revisit when a tester carries two phones. |
| `flutter_local_notifications` | FCM already covers background and terminated delivery — the safety-critical cases. In-foreground display is polish. |
| WS gateway load test | Meaningless below a real concurrent-user count. Leave doc 10's box unchecked *with a note*, rather than faking a number. |
| Battery benchmark over a real day | Needs a week of real usage; schedule it once closed testing starts. |
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
