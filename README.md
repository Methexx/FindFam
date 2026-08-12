# FindFam

FindFam is a privacy-first family safety app for people who want to share live location with trusted circles, chat in context, and send an SOS when something feels wrong. The product is designed to feel closer to a consent-based alternative to Life360 or Zenly than to a surveillance app: everyone in a circle chooses to share, everyone can see the same live map, and SOS alerts go to the circle and emergency contacts.

This repository is a Turborepo monorepo with three apps that share a single backend and database:

| App | Stack | Purpose |
|---|---|---|
| `apps/mobile` | Flutter | Main user app for live location, chat, contacts, and SOS |
| `apps/backend` | Fastify + TypeScript | REST API, realtime gateway, background jobs |
| `apps/admin-web` | Next.js + Tailwind | Web app for users, plus the internal moderation dashboard and live SOS monitoring |

## What The Project Does

At a high level, FindFam lets people create private circles, share their live location on a map, exchange messages, and trigger an SOS that is broadcast immediately and delivered through push notification. Users reach it from the Flutter app or, as of Sprint 10, a browser — the web app carries everything except the SOS trigger, which stays on the phone you actually carry. The same Next.js app also hosts the moderation dashboard, behind a separate login and a separate credential store; the two are not the same session and a user account cannot become an admin one.

The architecture, data model, API surface, and mobile structure are documented in the docs folder:
- [00-master-project-reference](docs/00-master-project-reference.md)
- [01-system-architecture](docs/01-system-architecture.md)
- [02-database-schema](docs/02-database-schema.md)
- [03-api-endpoints](docs/03-api-endpoints.md)
- [04-backend-structure](docs/04-backend-structure.md)
- [05-realtime-channels](docs/05-realtime-channels.md)
- [06-auth-flow](docs/06-auth-flow.md)
- [07-data-flow](docs/07-data-flow.md)
- [08-flutter-app-structure](docs/08-flutter-app-structure.md)
- [09-sprint-timeline](docs/09-sprint-timeline.md)
- [10-production-readiness](docs/10-production-readiness.md)
- [11-known-limitations](docs/11-known-limitations.md)
- [12-web-app-structure](docs/12-web-app-structure.md)

See also [PRIVACY.md](PRIVACY.md) (draft, pending legal review).

## Current Status

FindFam is still in active development. The repo is set up, the main app shells are in place, and the project is being built out in phases according to [09-sprint-timeline](docs/09-sprint-timeline.md).

## Repository Layout

```
apps/
  mobile/       Flutter app
  backend/      Fastify API, realtime gateway, queue workers
  admin-web/    Next.js admin dashboard
packages/
  shared-types/ Shared TypeScript types
  config/       Shared ESLint and TypeScript config
infra/          Dockerfiles and local development infrastructure
docs/           Product, architecture, API, and delivery reference
```

## Local Development

Day-to-day dev runs entirely against local Docker Postgres + Redis — Supabase and Upstash (both free tier) are only used by the deployed backend at runtime and by occasional migration runs against Supabase directly (see "Deploying" below). Install dependencies at the repo root, start the local services, copy `apps/backend/.env.example` to `apps/backend/.env` (the local connection strings are already filled in), migrate the local dev database, then run the workspace dev servers:

```bash
npm install
docker compose -f infra/docker-compose.yml up -d
cd apps/backend && npm run migrate:dev:up && cd ../..
npm run dev
```

### App-specific commands

Backend:

```bash
cd apps/backend
npm run dev
```

Admin web:

```bash
cd apps/admin-web
npm run dev
```

Mobile:

```bash
cd apps/mobile
flutter pub get
flutter run
```

## Seeding an admin

There is no public admin registration endpoint — admin accounts are created directly via a seed script, run from `apps/backend`:

```bash
cd apps/backend
npm run migrate:dev:up       # local Docker Postgres — this is what npm run dev talks to
npm run seed:admin -- --email=admin@example.com --password=changeme
```

Credentials can also be supplied via `ADMIN_SEED_EMAIL` / `ADMIN_SEED_PASSWORD` environment variables instead of flags. The script is idempotent — running it again with the same email makes no changes.

## Running backend tests

The backend integration test suite runs entirely against local Docker Postgres + Redis (`infra/docker-compose.yml`), never against the live Supabase/Upstash services — this is deliberate, so `npm test` can never touch real dev data. Start the local services, copy `apps/backend/.env.test.example` to `apps/backend/.env.test` and fill in the secrets, then apply migrations to the local test database:

```bash
docker compose -f infra/docker-compose.yml up -d
cd apps/backend
npm run migrate:test:up      # local test database (findfam_test)
npm run test
```

## Deploying

The backend deploys to Render, database on Supabase, cache/pub-sub on Upstash — all free tier. Migrations against Supabase are run manually, not as part of the deploy:

```bash
cd apps/backend
npm run migrate:up   # against Supabase, via DATABASE_MIGRATIONS_URL (direct connection, port 5432)
```

`DATABASE_URL` in Render's environment is Supabase's **pooled** connection (port 6543, Transaction pooler) — the deployed app never needs the direct connection, so `DATABASE_MIGRATIONS_URL` isn't set on Render at all. See `render.yaml` for the full list of environment variables Render expects (values are entered in Render's dashboard, not committed here).

## Root Scripts

The root package uses Turbo to run workspace tasks:

- `npm run dev` - run the Node/Next workspace dev servers
- `npm run build` - build all workspaces
- `npm run lint` - lint all workspaces
- `npm run test` - run all workspace tests

Launch the Flutter app separately with `flutter run` from `apps/mobile`.

## Tech Stack Summary

- Mobile: Flutter, Riverpod, MVVM
- Backend: Fastify, TypeScript, WebSockets, BullMQ, Redis
- Admin: Next.js, Tailwind CSS
- Database: PostgreSQL with PostGIS

## Why This Exists

The goal is to give families and close groups a safer, more transparent way to stay connected without turning location sharing into a one-way surveillance product. The docs explain the product decisions, the technical tradeoffs, and the rollout plan in more detail.
