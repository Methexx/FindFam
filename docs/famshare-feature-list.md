# FamShare — Complete Feature List

## MVP (Phase 0) — Build First

**Auth & Accounts**
- Username-based account creation
- Login / JWT session with refresh
- Follow / invite system by username

**Circles**
- Create circle
- Join circle (via invite/username)
- Leave circle
- Delete circle (owner only)
- Member roles (owner / member)

**Location**
- Live location sharing toggle (on/off)
- Live map showing circle members' positions
- Real-time broadcast via WebSocket

**Chat**
- In-app chat scoped to circles

**Emergency**
- Emergency contacts (app users or external phone numbers)
- SOS/danger button → sends live location + push + SMS to emergency contacts
- Continuous location streaming during active SOS

**Admin Web (Next.js)**
- Admin auth (separate role)
- User management (search, suspend, ban)
- Circle oversight / moderation
- Live SOS event monitoring feed
- Basic analytics (active users, circles, SOS events over time)

**DevOps**
- Docker + Docker Compose (local dev)
- CI pipeline (lint → test → build on PR)
- CD pipeline (auto-deploy backend + admin web on merge)
- Staging + prod environments
- Sentry error tracking
- Health-check endpoint + uptime monitoring
- Rate limiting on location writes

---

## Tier 1 — Trust & Delight Upgrades (build right after MVP)

- Persistent "you are sharing" indicator (always visible, no silent tracking)
- Per-circle pause / ghost mode (stop sharing without leaving circle)
- Per-member battery %, speed, and "time at current place" display
- Place check-ins / arrival & leave alerts (PostGIS geofencing)
- Public "we never sell your location" privacy stance

---

## Tier 2 — Retention Features (once you have real users)

- Location history + route playback
- Zenly-style "Footprints" — auto-generated personal place map over time
- Expressive chat — reactions, canned quick-replies ("on my way", "running late")
- Temporary timed share link for non-app users (Glympse-style, expiring web link)

---

## Tier 3 — Advanced / Optional (only with traction + risk tolerance)

- Driving / speed reports
- Silent SOS triggers (shake, power-button 3–5×, hold-to-cancel-with-PIN)
- Crash detection (accelerometer + gyroscope + GPS fusion) — highest liability/false-positive risk, hardest to tune solo

---

## Explicitly Out of Scope

- 24/7 emergency dispatch / live agent
- Roadside assistance
- Stolen-fund reimbursement / ID-theft insurance
- Automated 911/PSAP dispatch integration

*(These require monitoring-center partnerships and capital — not realistic for a solo project. SOS routes to the user's own emergency contacts + circle + admin dashboard instead, with a clear disclaimer that the app is not a substitute for emergency services.)*

---

## Suggested Build Order

1. Auth + user schema (mobile + backend)
2. Circles CRUD
3. Location streaming + live map
4. Emergency contacts + SOS trigger
5. Admin web: auth, user list, SOS monitoring feed
6. DevOps layer (parallel with steps 3–4)
7. Tier 1 features
8. Tier 2 features
9. Tier 3 (optional, evaluate after traction)
