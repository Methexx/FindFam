# 04 — Backend Structure

## Framework & Conventions
Fastify + TypeScript, following the same conventions as School Connect's backend for consistency. Plugin-based architecture (Fastify's native pattern) rather than a monolithic app file.

## Folder Structure
```
apps/backend/
├── src/
│   ├── app.ts                     # Fastify instance creation, plugin registration
│   ├── server.ts                  # Entry point — starts the server
│   ├── config/
│   │   ├── env.ts                 # Environment variable validation (zod schema)
│   │   └── db.ts                  # Postgres connection pool setup
│   ├── plugins/
│   │   ├── auth.ts                # JWT verification plugin, decorates request.user
│   │   ├── admin-auth.ts          # Separate JWT verification for admin routes
│   │   ├── websocket.ts           # @fastify/websocket registration
│   │   ├── rate-limit.ts          # @fastify/rate-limit config
│   │   └── sentry.ts              # Error tracking hook
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.service.ts
│   │   │   ├── auth.schema.ts     # zod request/response schemas
│   │   │   └── auth.repository.ts # DB queries for this module
│   │   ├── follows/
│   │   │   ├── follows.routes.ts
│   │   │   ├── follows.service.ts
│   │   │   ├── follows.schema.ts
│   │   │   └── follows.repository.ts
│   │   ├── circles/
│   │   │   ├── circles.routes.ts
│   │   │   ├── circles.service.ts
│   │   │   ├── circles.schema.ts
│   │   │   └── circles.repository.ts
│   │   ├── locations/
│   │   │   ├── locations.routes.ts
│   │   │   ├── locations.service.ts
│   │   │   ├── locations.schema.ts
│   │   │   └── locations.repository.ts
│   │   ├── geofences/             # Tier 1
│   │   ├── messages/
│   │   │   ├── messages.routes.ts
│   │   │   ├── messages.service.ts
│   │   │   ├── messages.schema.ts
│   │   │   └── messages.repository.ts
│   │   ├── emergency-contacts/
│   │   │   ├── emergency-contacts.routes.ts
│   │   │   ├── emergency-contacts.service.ts
│   │   │   ├── emergency-contacts.schema.ts
│   │   │   └── emergency-contacts.repository.ts
│   │   ├── sos/
│   │   │   ├── sos.routes.ts
│   │   │   ├── sos.service.ts
│   │   │   ├── sos.schema.ts
│   │   │   └── sos.repository.ts
│   │   └── admin/
│   │       ├── admin.routes.ts
│   │       ├── admin.service.ts
│   │       ├── admin.schema.ts
│   │       └── admin.repository.ts
│   ├── realtime/
│   │   ├── ws-gateway.ts          # WS connection handling, auth on upgrade
│   │   ├── channels/
│   │   │   ├── location.channel.ts
│   │   │   ├── chat.channel.ts
│   │   │   └── sos.channel.ts
│   │   └── redis-pubsub.ts        # Pub/Sub fan-out for multi-instance scaling
│   ├── queue/
│   │   ├── sos.queue.ts           # BullMQ queue definition
│   │   └── sos.worker.ts          # Worker: FCM push to each emergency contact, retried with backoff
│   ├── lib/
│   │   ├── fcm.ts                 # Firebase Admin SDK wrapper
│   │   ├── jwt.ts                 # sign/verify helpers
│   │   └── password.ts            # hash/verify helpers
│   └── types/
│       └── fastify.d.ts           # Fastify type augmentation (request.user, etc.)
├── migrations/                    # SQL migration files (see below)
├── test/
│   ├── modules/                   # unit + integration tests per module
│   └── setup.ts
├── Dockerfile
├── package.json
└── tsconfig.json
```

## Module Pattern (per feature)
Each module follows the same four-file pattern for consistency and testability:
- **`*.routes.ts`** — registers Fastify routes, wires request → service, applies schema validation
- **`*.service.ts`** — business logic, orchestrates repository calls, no direct DB access
- **`*.schema.ts`** — zod schemas for request/response validation + TypeScript type inference
- **`*.repository.ts`** — raw DB queries for this module (using `pg` or a lightweight query builder — Kysely recommended for type-safe SQL without a heavy ORM)

## Database Access
- **Kysely** (type-safe SQL query builder) recommended over a full ORM — gives you raw SQL control (needed for PostGIS functions like `ST_DWithin`) while keeping TypeScript types in sync with the schema.
- Migrations managed via a dedicated migration tool (`node-pg-migrate` or Kysely's migration system) — plain SQL files in `migrations/`, numbered sequentially.

## Realtime Design Notes
- WS gateway authenticates on connection upgrade (JWT in query param or initial message)
- Each connection subscribes to Redis channels for the circles the user belongs to
- Location and chat messages are written to Postgres *and* published to Redis in the same request — Redis publish should not block the DB write path (fire-and-forget with error logging)

## Environment Variables (`.env` — validated via zod at boot)
```
DATABASE_URL=          # Supabase connection string (local dev: Dockerized Postgres)
REDIS_URL=              # Upstash connection string (local dev: Dockerized Redis)
JWT_SECRET=
JWT_REFRESH_SECRET=
ADMIN_JWT_SECRET=
FCM_SERVICE_ACCOUNT_JSON=
SENTRY_DSN=
NODE_ENV=
PORT=
```
No Twilio/SMS credentials — free-tier MVP delivers SOS alerts via FCM only (see 00-master-project-reference.md cost/scope decision).

## Testing Approach
- Unit tests for services (mock repositories)
- Integration tests for routes against a test Postgres instance (Docker Compose test profile)
- Prioritize test coverage on: auth flow, SOS trigger path, geofence containment queries — the three highest-consequence code paths
