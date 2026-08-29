# 12 — Web App Structure

The counterpart to `docs/04-backend-structure.md` and `docs/08-flutter-app-structure.md`. It describes `apps/admin-web` as it stands today, which is **no longer admin-only**: the consumer surface at `/app` — registration, login, circles, follows and the live map — is built. Chat, emergency contacts and SOS-receive on the web are not; they are marked below where they come up.

The directory is still named `admin-web`. It has stopped being admin-only and the name should follow, but in its own commit rather than bundled with the routes — see the Deferred table in `docs/09-sprint-timeline.md`.

## Stack

Next.js 14 App Router, TypeScript, React 18. Tailwind CSS with shadcn/ui (`components.json`, style `default`, baseColor slate). `lucide-react` for icons, `class-variance-authority` + `clsx` + `tailwind-merge` behind the `cn()` helper in `lib/utils.ts`. Sentry via `@sentry/nextjs`.

There is deliberately **no data-fetching or state library** — no Redux, Zustand, React Query or SWR, and no React Context anywhere. Server Components fetch directly and `router.refresh()` re-runs them after a mutation. That is sufficient for the dashboard and should be reconsidered only when the user surface has a screen it genuinely fails — the live map is the likely first candidate, and even there the WebSocket client owns the state, not a store.

Dev server runs on **port 3001** (`next dev -p 3001`), which is what the backend's `ALLOWED_ORIGINS` defaults to.

## Route groups

```
app/
  page.tsx                    Landing, user-facing
  architecture/               The technical landing page
  login/                      One form, routed by which issuer accepts it
  register/                   User signup
  (user)/app/                 Consumer surface
    page.tsx                    Overview + first-run checklist
    map/                        Live circle map (react-leaflet + WS)
    circles/  circles/[id]/     List, create, join by code, members, invite code
    people/                     Follows: pending inbox, accepted list, send request
  dashboard/                  Moderation surface
    sos/  users/  circles/  analytics/
  api/                        Route handlers acting as a BFF (see below)
```

The `(user)` route group keeps the consumer surface on its own layout without putting `(user)` in the URL. `dashboard/` was deliberately **not** moved into a matching `(admin)` group: it already has its own `layout.tsx`, so the group would buy nothing, and a pure path move would have buried the real diff. It can ride along with the eventual `admin-web` → `web` rename.

`middleware.ts` matches both prefixes and redirects on whichever cookie is missing — and, for `/app`, refreshes the user access token. See "Sessions" below.

## The BFF layer

`app/api/*` route handlers exist for one reason: **tokens live in httpOnly cookies and the browser must never hold one in JavaScript.** A handler takes the credentials, calls the backend, and sets the cookie; Server Components then read that cookie and call the backend directly with a bearer header.

| Cookie | Lifetime | Notes |
|---|---|---|
| `admin_token` | 8h | Expires; no refresh |
| `user_token` | 15min | Refreshed against `POST /auth/refresh` |
| `user_refresh_token` | 7d | Does **not** rotate — replace the access token only |

Routes:

| Route | Purpose |
|---|---|
| `POST /api/auth/{register,login,logout}` | User session: sets/clears both cookies |
| `GET /api/auth/ws-token` | Exchanges the cookie for a 60s ws-scoped token |
| `ALL /api/user/[...path]` | The write proxy — see below |
| `POST /api/admin/{login,logout}`, `GET /api/admin/ws-token` | Admin equivalents |
| `GET /api/admin/sos-active` | Re-read for the SOS feed's reconnect reconcile |

**Reads go through `userApiGet`; writes go through `/api/user/[...path]`.** A Server Component cannot mutate and a client component cannot attach the httpOnly bearer, so every mutation needs a route handler. That is one catch-all rather than eight near-identical files that could only differ by drifting. It carries an explicit allowlist of path prefixes (`circles`, `follows`, `locations`, `auth/me`) — not because the allowlist is what makes it safe (every one of those is already authorized server-side against the caller's own token) but so the surface is written down and it can never be aimed at `/admin/*`.

## Sessions

The refresh loop is the one piece of real complexity here, it applies to users only, and **it lives in `middleware.ts` because it has to**: a Next 14 Server Component can read cookies but cannot set them, so middleware is the only place a refreshed access token can be persisted. It mutates `request.cookies` before constructing the response as well as setting the response cookie — without that, the fresh token reaches the browser but the page currently rendering still uses the expired one, so every first navigation after an expiry would fail.

`refreshAccessToken` in `lib/user-session.ts` returns three outcomes, not two: `refreshed`, `rejected` (401/403 — clear the session) and `unavailable` (network or 5xx — keep the cookies and let the request through). Collapsing the last two into a nullable token signs users out every time the API blips.

`userApiGet` also refreshes-and-retries once on a 401, but deliberately does **not** persist the result — it cannot, and middleware owns that write. It is the in-render safety net for a token that expired between middleware running and the fetch, not the loop itself.

See `docs/06-auth-flow.md`.

## Conventions

- **Server Components fetch; Client Components hold interaction state.** A page is a Server Component unless it needs an event handler or a subscription. The `'use client'` boundary sits as low in the tree as it can — `app/dashboard/users/page.tsx` fetches on the server and delegates only the search box and the row actions.
- **One API client, not a per-file fetch.** Sprint 8 introduces `lib/api-client.ts` to replace a base-URL fallback duplicated across eight files, each swallowing its errors into an empty state. Sprint 10 extends it with user-scoped and admin-scoped callers over one base. Do not add a ninth inline `fetch`.
- **`middleware.ts` is not a security boundary.** It checks cookie presence for a cheap redirect. It cannot do more — the web app does not hold `ADMIN_JWT_SECRET` and should not. Real authorization is the backend's 401.
- **Shared types come from `@findfam/shared-types`**, not from `as`-casts on backend JSON.
- Loading UI is a sibling `loading.tsx` per route using `components/ui/skeleton.tsx`.

## Components

`components/ui/` holds the shadcn primitives in use: `accordion`, `alert`, `badge` (with a custom `success` variant), `button`, `card`, `dialog`, `input`, `label`, `skeleton`, `table`, `tabs`. The `animate-in`/`fade-out` classes shadcn ships on dialog and accordion were **stripped**, not kept: `tailwindcss-animate` is not installed, so they would be dead classes shipped as if they did something. `toast` was deliberately skipped — it needs a root-layout provider for a surface with three mutations, and `alert` already renders inline errors.

`components/landing/` holds the hand-built `ArchitectureDiagram` and `JourneyTrace` (driven by `lib/landing-content.ts`, both behind `/architecture`), plus `AppPreview` — the static SVG/CSS mockup of `/app/map` that sits under the hero on `/`. It is a picture of the product, not the product: no Leaflet, no tiles, no data, and no `'use client'`.

`components/map/` holds `CircleMap` and `ShareLocationToggle`.

## Theme

Dark-only by deliberate choice — `app/layout.tsx` hardcodes `className="dark"` and `app/globals.css` defines a single palette under `:root`. The light block was removed rather than left unreachable, after a period where the tokens existed but nothing applied the `.dark` class so the site always rendered light. If a light theme is ever wanted, it comes back as a real toggle, not as dead tokens.

## Realtime

`lib/ws-client.ts` holds `useReconnectingSocket`, the one client both surfaces run on: exponential backoff from 1s to a 30s cap with jitter, and an `onReconnected` reconcile hook — the semantics already proven in mobile's `core/network/ws_client.dart`. `useFindFamSocket` (user) and `useAdminSosFeed` (admin, in `lib/admin-ws-client.ts`) are thin wrappers differing only in token URL, auth frame and ack type.

The admin feed previously had **no reconnect, no backoff and no heartbeat** — the first error set `'closed'` permanently, which behind Render's idle-socket-dropping proxy made a dead feed look merely quiet. It now shares the client above.

**Reconnecting must reconcile, not just resume.** The gateway has no replay, so anything broadcast while a socket was down was never delivered: the map re-reads `GET /circles/:id/locations/latest` for every circle it holds, and the SOS feed re-reads `GET /admin/sos/active`. Without that a feed comes back looking healthy while missing exactly the events that happened during the outage.

The user client also sends `circles:resync` after **every** successful auth. The gateway resolves circle membership once, at auth time, and expects the client to ask for a re-resolve rather than pushing one — so a circle joined in another tab, or while the socket was down, would otherwise broadcast nothing until a reload.

Both surfaces authenticate with an initial message rather than a query parameter, so tokens stay out of proxy logs. Neither can read its own httpOnly session cookie, so both exchange it server-side for a 60s ws-scoped token first (`POST /auth/ws-token`, `POST /admin/auth/ws-token`). Note the asymmetry: the gateway asserts `aud: 'ws'` on the **admin** branch only — the user branch must not, because mobile authenticates with a plain access token and asserting it there would disconnect every phone.

## Maps

`react-leaflet`, against the **same CARTO Voyager tile URL** held in `apps/mobile/lib/core/map/map_tile_config.dart` and re-declared in `lib/map-config.ts` with a comment pointing back at it — two clients on different tile sources look like two products.

`CircleMap` must be imported with `dynamic(..., { ssr: false })`: Leaflet touches `window` at module scope, so this is a hard requirement, not a preference. It keeps Leaflet out of every other route's bundle as a side effect.

Markers mirror `member_marker.dart` — an avatar ring centred on the coordinate rather than a teardrop pin, faded to 55% with a clock badge once the position is stale. **`STALE_AFTER_MS` is 5 minutes and must stay equal to `MemberLocation.isStale`**; a stale pin drawn as a live one is the specific way this kind of map lies to the person reading it. The viewport fits all members the way mobile's `CameraFit.coordinates` does, keyed on the circle rather than on positions so an incoming broadcast does not yank the map away from somebody who has panned.

Browser location sharing works only while the tab is open; there is no web equivalent of the Android foreground service, and the indicator says **"while this tab is open"** rather than just "sharing". Updates are throttled client-side to 5s against the server's 4s `MIN_UPDATE_INTERVAL_MS`, so an indoor `watchPosition` storm does not just generate 429s.

The toggle deliberately does **not** write `users.is_sharing` via `PATCH /locations/sharing-status`. That flag is one global per user and gates nothing server-side — `submitLocation` never reads it — so it exists to drive the phone's persistent indicator. A per-tab toggle writing it could only mislead: clearing it when a tab closes would tell the phone it had stopped sharing when it had not, and setting it would leave the phone claiming to share after the tab closed. The phone owns that flag.

See `docs/11-known-limitations.md`.

## Testing

vitest, node environment, `npm test --workspace=@findfam/admin-web`. 31 tests across `test/middleware.test.ts` (session routing and every branch of the refresh loop, including that the non-rotating refresh cookie is never rewritten and that an unreachable backend does not sign anybody out) and `test/lib/api-client.test.ts` (both callers, and the 401 → refresh → retry-once path).

## CI

`.github/workflows/admin-web-ci.yml` — `pull_request` only, path-filtered to `apps/admin-web/**` and `packages/**`. Node 20, lint and build, no test job yet. Deploys to Vercel, which builds natively; `infra/Dockerfile.admin-web` is unused and Sprint 9 deletes it.
