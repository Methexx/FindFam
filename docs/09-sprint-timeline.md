# 09 — Sprint Timeline

## Format
6 sprints × 2 weeks = 12 weeks, solo/part-time (matches your School Connect pace). Each sprint lists: **file/repo structure to set up**, **feature work**, and **DevOps work** — structure setup is front-loaded within each sprint so you're never writing feature code into an undefined folder layout.

---

## Sprint 0 (Days 1–3, pre-Sprint-1 setup) — Monorepo & Environment Bootstrap
**Goal:** empty-but-runnable skeleton for all three apps, no features yet.

**File/repo structure:**
```
findfam/
├── apps/mobile/ (flutter create)
├── apps/backend/ (fastify skeleton per 04-backend-structure)
├── apps/admin-web/ (next.js skeleton)
├── packages/shared-types/
├── packages/config/
├── infra/docker-compose.yml, Dockerfile.backend, Dockerfile.admin-web
├── .github/workflows/ (empty placeholders)
└── turbo.json, root package.json
```
- Set up Turborepo, root `package.json` workspaces
- `docker-compose.yml`: Postgres+PostGIS container, Redis container
- Backend: create the full `src/` folder tree from 04-backend-structure (empty files with TODO comments — this is deliberate, so every later sprint has a home to write into)
- Admin web: default Next.js app router structure
- Mobile: `flutter create`, add `features/` and `core/` folders from 08-flutter-app-structure

**DevOps:** GitHub repo, branch protection on `main`, `.env.example` files for backend + admin-web

---

## Sprint 1 (Weeks 1–2) — Auth Everywhere
**Feature work:**
- Backend: `modules/auth/` (register, login, refresh, logout) per 06-auth-flow
- Database: migrations for `users`, `refresh_tokens`, `admins` tables
- Admin web: `modules/admin/` auth routes + admin login page
- Mobile: `features/auth/` — register/login screens, secure token storage, `api_client.dart` with refresh interceptor

**DevOps:**
- First CI workflow: `backend-ci.yml` (lint → test → build on PR)
- Deploy backend to Render (free tier) for the first time; database on Supabase (free tier, PostGIS enabled)
- Sentry wired into backend

**End-of-sprint checkpoint:** a user can register and log in from the mobile app; an admin can log into the admin web separately.

---

## Sprint 2 (Weeks 3–4) — Circles & Follows
**Feature work:**
- Backend: `modules/follows/`, `modules/circles/` + migrations for `follows`, `circles`, `circle_members`
- Mobile: `features/circles/` — create/join/leave/delete UI, follow-by-username flow
- Admin web: circle list/detail view (read-only moderation view begins here)

**DevOps:**
- `admin-web-ci.yml` added
- Vercel preview deployments enabled for admin-web PRs

**Checkpoint:** users can follow each other and form circles end-to-end.

---

## Sprint 3 (Weeks 5–6) — Live Location + Realtime Layer
**Feature work:**
- Backend: `realtime/` (ws-gateway, Redis pub/sub, location channel) per 05-realtime-channels; `modules/locations/` + `locations` migration (PostGIS geography column, GIST index)
- Mobile: `core/network/ws_client.dart`, `core/location/` (background service, motion-adaptive sampling), `features/map/` live map screen
- Admin web: nothing new this sprint (buffer for realtime complexity — this is the hardest sprint technically)

**DevOps:**
- `mobile-ci.yml` (lint, test, build APK)
- Redis (Upstash, free tier) provisioned and connected

**Checkpoint:** two test accounts in the same circle can see each other move live on the map.

---

## Sprint 4 (Weeks 7–8) — Chat + Emergency Contacts + SOS
**Feature work:**
- Backend: `realtime/channels/chat.channel.ts`, `modules/messages/`; `modules/emergency-contacts/`; `modules/sos/` + `queue/` (BullMQ setup, FCM integration) per 07-data-flow Journey 2
- Mobile: `features/chat/`, `features/emergency_contacts/`, `features/sos/` (SOS button, active-SOS banner)
- Admin web: `features/sos` live feed page (subscribes to `admin:sos` WS channel) — this is the dashboard's centerpiece feature

**DevOps:**
- FCM service account credentials added to Render's environment variables
- Load-test the SOS path specifically (this is your safety-critical path — worth deliberate testing time, not just happy-path checks)

**Checkpoint:** full MVP feature set works end-to-end, including a real SOS trigger delivering an FCM push notification.

---

## Sprint 5 (Weeks 9–10) — Admin Moderation + Tier 1 Features
**Feature work:**
- Admin web: user management (search, suspend/unsuspend), analytics summary page
- Backend: admin user-management endpoints, basic audit logging for moderation actions
- Tier 1: persistent "sharing is on" indicator, pause/ghost mode toggle, battery/speed/time-at-place display, geofences (`modules/geofences/` + migration)
- Mobile: profile screen sharing toggle, geofence-based place alerts

**DevOps:**
- Uptime monitoring (health-check endpoint + external ping service) — this also doubles as the Supabase keep-alive ping per 00-master-project-reference.md
- Confirm Render free-tier cold-start behavior is acceptable for the closed-testing group, or evaluate whether it's worth the (paid) always-on upgrade before wider rollout

**Checkpoint:** admin dashboard is a usable moderation tool; app has its first real trust/delight differentiators live.

---

## Sprint 6 (Weeks 11–12) — Hardening & Production Readiness
**Feature work:**
- Bug fixes and polish from prior sprints (deliberately reserved, not packed with new features)
- Privacy policy + in-app disclaimers (SOS is not a substitute for emergency services)
- App store listing prep (screenshots, descriptions) if targeting real deployment

**DevOps:**
- Full production deployment (backend, admin-web, database)
- Rate limiting finalized on location + auth endpoints
- Sentry alerting rules configured (not just logging — actual alerts on error spikes)
- Security review pass: JWT secret rotation plan, dependency audit (`npm audit`, `flutter pub outdated`)
- Full checklist from **10-production-readiness** run through top to bottom

**Checkpoint:** production-deployed MVP + Tier 1, ready to demo or submit as a portfolio piece.

---

## Beyond Sprint 6 — Tier 2 / Tier 3 (open-ended, post-MVP)
Not scheduled into fixed sprints since these are traction-gated (per the feature list — build these once you have real users, not on a fixed calendar):
- Tier 2: location history + playback, Footprints personal place map, expressive chat, temporary share links
- Tier 3 (optional): driving reports, silent SOS variants, crash detection — evaluate case-by-case given the liability/effort tradeoffs already flagged in the feature research

## Notes on This Timeline
- **Sprint 3 (realtime) is the highest-risk sprint** — if you're behind schedule anywhere, it will most likely be here. Consider giving it 3 weeks instead of 2 if needed rather than compressing Sprint 4 (SOS), which is the safety-critical one.
- Structure setup is intentionally front-loaded (Sprint 0) rather than spread out — you write into folders that already exist and mirror docs 02–08, instead of restructuring mid-sprint.
- DevOps tasks are threaded through every sprint rather than batched at the end, so you're not retrofitting CI/CD, monitoring, or secrets management onto a finished app in Sprint 6 — Sprint 6 is hardening, not first-time setup.
