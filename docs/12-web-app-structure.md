# 12 — Web App Structure

The counterpart to `docs/04-backend-structure.md` and `docs/08-flutter-app-structure.md`, which the web app went without until now. It describes `apps/admin-web` as it stands today **and** the shape Sprints 10–12 give it, marking clearly which is which — the app currently serves only admins, and most of what follows is planned rather than built.

The directory is still named `admin-web`. It stops being admin-only in Sprint 10 and the name should follow, but in its own commit rather than bundled with the routes — see the Deferred table in `docs/09-sprint-timeline.md`.

## Stack

Next.js 14 App Router, TypeScript, React 18. Tailwind CSS with shadcn/ui (`components.json`, style `default`, baseColor slate). `lucide-react` for icons, `class-variance-authority` + `clsx` + `tailwind-merge` behind the `cn()` helper in `lib/utils.ts`. Sentry via `@sentry/nextjs`.

There is deliberately **no data-fetching or state library** — no Redux, Zustand, React Query or SWR, and no React Context anywhere. Server Components fetch directly and `router.refresh()` re-runs them after a mutation. That is sufficient for the dashboard and should be reconsidered only when the user surface has a screen it genuinely fails — the live map is the likely first candidate, and even there the WebSocket client owns the state, not a store.

Dev server runs on **port 3001** (`next dev -p 3001`), which is what the backend's `ALLOWED_ORIGINS` defaults to.

## Route groups

```
app/
  page.tsx                    Landing (user-facing from Sprint 12)
  architecture/               The technical landing page, moved here in Sprint 12
  login/                      One form, routed by which issuer accepts it
  register/                   Sprint 10
  (user)/app/                 Sprint 10-11 — consumer surface
    map/  circles/  chat/  contacts/  profile/
  (admin)/dashboard/          Existing moderation surface
    sos/  users/  circles/  analytics/
  api/                        Route handlers acting as a BFF (see below)
```

Route groups keep the two surfaces on separate layouts without putting `(user)`/`(admin)` in the URL. `middleware.ts` matches both prefixes and redirects on whichever cookie is missing.

## The BFF layer

`app/api/*` route handlers exist for one reason: **tokens live in httpOnly cookies and the browser must never hold one in JavaScript.** A handler takes the credentials, calls the backend, and sets the cookie; Server Components then read that cookie and call the backend directly with a bearer header.

| Cookie | Lifetime | Notes |
|---|---|---|
| `admin_token` | 8h | Expires; no refresh |
| `user_token` | 15min | Refreshed against `POST /auth/refresh` |
| `user_refresh_token` | 7d | Does **not** rotate — replace the access token only |

The refresh loop is the one piece of real complexity here and it applies to users only. See `docs/06-auth-flow.md`.

## Conventions

- **Server Components fetch; Client Components hold interaction state.** A page is a Server Component unless it needs an event handler or a subscription. The `'use client'` boundary sits as low in the tree as it can — `app/dashboard/users/page.tsx` fetches on the server and delegates only the search box and the row actions.
- **One API client, not a per-file fetch.** Sprint 8 introduces `lib/api-client.ts` to replace a base-URL fallback duplicated across eight files, each swallowing its errors into an empty state. Sprint 10 extends it with user-scoped and admin-scoped callers over one base. Do not add a ninth inline `fetch`.
- **`middleware.ts` is not a security boundary.** It checks cookie presence for a cheap redirect. It cannot do more — the web app does not hold `ADMIN_JWT_SECRET` and should not. Real authorization is the backend's 401.
- **Shared types come from `@findfam/shared-types`**, not from `as`-casts on backend JSON.
- Loading UI is a sibling `loading.tsx` per route using `components/ui/skeleton.tsx`.

## Components

`components/ui/` holds the shadcn primitives in use: `alert`, `badge` (with a custom `success` variant), `button`, `card`, `input`, `skeleton`, `table`. Sprint 11 adds dialog, dropdown, toast, tabs and form — taken from shadcn rather than hand-rolled, matching how the existing seven arrived.

`components/landing/` holds the hand-built `ArchitectureDiagram` and `JourneyTrace`, driven by `lib/landing-content.ts`. Sprint 12 moves both behind `/architecture`.

## Theme

Dark-only by deliberate choice — `app/layout.tsx` hardcodes `className="dark"` and `app/globals.css` defines a single palette under `:root`. The light block was removed rather than left unreachable, after a period where the tokens existed but nothing applied the `.dark` class so the site always rendered light. If a light theme is ever wanted, it comes back as a real toggle, not as dead tokens.

## Realtime

`lib/admin-ws-client.ts` opens the admin SOS feed. It has **no reconnect, no backoff and no heartbeat** — the first error sets `'closed'` permanently, which behind Render's idle-socket-dropping proxy makes a dead feed look merely quiet.

Sprint 11 replaces it with a shared client carrying the exponential-backoff and reconnect-reconcile semantics already proven in mobile's `core/network/ws_client.dart`, and moves the admin feed onto it. Both surfaces authenticate with an initial message rather than a query parameter, so tokens stay out of proxy logs.

## Maps

None today; SOS coordinates render as text. Sprint 11 introduces `react-leaflet` against the **same CARTO Voyager tile URL** held in `apps/mobile/lib/core/map/map_tile_config.dart`, and mirrors `member_marker.dart`'s marker treatment — avatar rings with staleness fading — so a stale position never renders as a live one.

Browser location sharing works only while the tab is open; there is no web equivalent of the Android foreground service. See `docs/11-known-limitations.md`.

## Testing

The only app with no test tooling. Sprint 9 adds vitest and a first set of tests.

## CI

`.github/workflows/admin-web-ci.yml` — `pull_request` only, path-filtered to `apps/admin-web/**` and `packages/**`. Node 20, lint and build, no test job yet. Deploys to Vercel, which builds natively; `infra/Dockerfile.admin-web` is unused and Sprint 9 deletes it.
