# FamShare

FamShare is a live location sharing app for families: a Flutter mobile app, a Fastify + TypeScript backend (REST + WebSocket + BullMQ), and a Next.js admin dashboard, sharing one PostgreSQL+PostGIS database.

See [docs/famshare-feature-list.md](docs/famshare-feature-list.md) for the full feature list and project overview, and the rest of [docs/](docs/) for architecture, database schema, API endpoints, and the sprint timeline.

## Monorepo layout

```
apps/
  mobile/       # Flutter app
  backend/      # Fastify + TypeScript API, WebSocket gateway, BullMQ workers
  admin-web/    # Next.js admin dashboard
packages/
  shared-types/ # TypeScript types shared between backend and admin-web
  config/       # Shared tsconfig + ESLint config
infra/          # Docker Compose + Dockerfiles for local dev and builds
```

## Local development

```
npm install
docker-compose -f infra/docker-compose.yml up -d
npm run dev
```
