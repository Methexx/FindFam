# 01 — System Architecture

## Overview
FindFam is a three-application system sharing one backend: a Flutter mobile app (primary user surface), a Fastify API + realtime layer (backend), and a Next.js admin dashboard (moderation/monitoring). All three live in one monorepo and talk to a single Postgres+PostGIS database.

## Component Diagram (Mermaid — renders on GitHub/most markdown viewers)

```mermaid
flowchart TB
    subgraph Client["Client Apps"]
        Mobile["Flutter Mobile App\n(iOS + Android)"]
        AdminWeb["Next.js Admin Web"]
    end

    subgraph Backend["Backend (Fastify, TypeScript)"]
        API["REST API\nauth, circles, contacts, admin"]
        WS["WebSocket Gateway\nlocation + chat + SOS"]
        Queue["BullMQ Worker\nSOS delivery, push"]
    end

    subgraph Data["Data Layer"]
        PG[("PostgreSQL + PostGIS")]
        Redis[("Redis\nPub/Sub + Queue")]
    end

    subgraph External["External Services"]
        FCM["Firebase Cloud Messaging"]
        Sentry["Sentry"]
    end

    Mobile -- "HTTPS (REST)" --> API
    Mobile -- "WSS" --> WS
    AdminWeb -- "HTTPS (REST)" --> API
    AdminWeb -- "WSS (SOS feed)" --> WS

    API --> PG
    WS --> PG
    WS <--> Redis
    API --> Queue
    Queue --> Redis
    Queue --> FCM

    API -.errors.-> Sentry
    WS -.errors.-> Sentry
    Mobile -.errors.-> Sentry
    AdminWeb -.errors.-> Sentry
```

## Layer Responsibilities

### Mobile app (Flutter)
- Captures and streams GPS location in the background (motion-adaptive, battery-conscious)
- Renders the live map of circle members
- Handles auth (login, token storage via `flutter_secure_storage`)
- Sends/receives chat messages over WebSocket
- Triggers SOS and manages emergency contacts
- Displays sharing-status indicator and pause/ghost mode toggle (Tier 1)

### Backend — REST API (Fastify)
- Auth endpoints (register, login, refresh, logout)
- Circle CRUD, membership management
- Emergency contact CRUD
- Admin-only endpoints (user/circle moderation, analytics)
- Issues short-lived JWT access tokens + longer-lived refresh tokens

### Backend — WebSocket gateway
- Accepts authenticated WS connections from mobile + admin web
- Broadcasts location updates to circle members in real time
- Routes chat messages within a circle
- Broadcasts SOS trigger events to circle members and to the admin dashboard's live feed
- Uses Redis Pub/Sub as the fan-out layer so this can scale horizontally later (single instance is fine for MVP, but the pattern is in place from day one)

### Backend — Queue worker (BullMQ + Redis)
- Consumes SOS-trigger jobs and handles delivery with retries: FCM push to each emergency contact, retried with backoff if delivery isn't confirmed
- Decouples "SOS was triggered" (must be instant, must never be lost) from "notification was delivered" (may need retries)
- Free-tier MVP delivers via FCM only — emergency contacts must be FindFam users (see 00-master-project-reference.md cost/scope decision); SMS fallback for non-app contacts is a future paid-tier addition, not implemented here

### Data layer
- **PostgreSQL + PostGIS**: source of truth for users, circles, locations, messages, emergency contacts, SOS events. PostGIS enables geofence containment queries for Tier 1 place alerts.
- **Redis**: Pub/Sub backplane for WebSocket fan-out, plus the BullMQ job queue for SOS delivery.

### Admin web (Next.js)
- Separate admin auth (not a regular user account)
- Server-rendered dashboard: user list, circle list, live SOS feed (subscribes to the same WebSocket gateway), basic analytics queries against Postgres

## Data Flow Summary (detail in 07-data-flow)
1. Mobile app streams location → WebSocket gateway → written to Postgres + broadcast to circle members' open connections
2. Chat message → WebSocket gateway → written to Postgres → broadcast to circle members
3. SOS trigger → WebSocket gateway (instant broadcast to circle + admin feed) AND enqueued to BullMQ → worker sends FCM push to each emergency contact, retries with backoff on failure (no SMS path in the free-tier MVP — see 00-master-project-reference.md)

## Why this architecture (rationale)
- **Fastify over Express**: lower overhead, native TypeScript-friendly, matches your existing School Connect backend conventions
- **WebSocket over pure polling**: location and chat both need low-latency push, and polling would waste battery/bandwidth on mobile — directly conflicts with the battery-efficiency goal from the feature research
- **Redis Pub/Sub from day one, even at single-instance scale**: cheap to add now, expensive to retrofit later if you ever need to run multiple backend instances
- **BullMQ queue specifically for SOS**: this is the one place reliability matters more than simplicity — a direct, unqueued API call to FCM with no retry logic is a single point of failure for your most safety-critical feature
- **PostGIS**: purpose-built for geofence/proximity queries (`ST_DWithin`, `ST_Contains`), avoids hand-rolling distance math in application code

## Environments
| Environment | Backend | Admin Web | Database | Redis |
|---|---|---|---|---|
| Local dev | `npm run dev` (Fastify, no container) | `next dev` | Supabase (free tier, PostGIS enabled) | Upstash (free tier) |
| Local test suite | Docker Compose (isolated, never Supabase — see Sprint 2 fix) | n/a | Dockerized Postgres+PostGIS | Dockerized Redis |
| Staging/Production | Render (free tier, single service — no separate staging environment on the free tier; see note below) | Vercel (preview deployments per PR + production) | Supabase (free tier, PostGIS enabled) | Upstash (free tier) |

**Note:** the free-tier stack does not support a fully separate staging environment for the backend without a second paid Render service. For now, Render's PR preview / manual promotion workflow substitutes for staging — treat `main` deploys carefully and rely on the CI test suite (run against the isolated local test DB, per Sprint 2) as the primary safety net before merge.

## Resolved Decisions
- **Managed Postgres provider:** Supabase (free tier, PostGIS confirmed available) — resolved August 2026, see 00-master-project-reference.md
- **WebSocket gateway and REST API:** run as one Fastify process (MVP decision, split later only if scaling requires it — no change from original plan)
