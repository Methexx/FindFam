# Claude Code Prompt — Pre-Sprint-4: Free-Tier Infrastructure Migration

Copy everything below into Claude Code as your next instruction. Run this before starting Sprint 4.

---

I'm continuing work on **FamShare**. Sprints 0–3 are complete and verified against local Docker services (Postgres+PostGIS, Redis). I've updated the docs (`docs/00-master-project-reference.md`, `01-system-architecture.md`, `02-database-schema.md`, `03-api-endpoints.md`, `04-backend-structure.md`, `07-data-flow.md`, `09-sprint-timeline.md`, `10-production-readiness.md`) to reflect a locked decision: **the production stack runs entirely on free tiers, with zero recurring paid services.** Re-read all of these before starting — several implementation details change as a result.

Two concrete decisions to internalize before touching code:
1. **Database → Supabase** (free tier, PostGIS confirmed enabled). **Redis → Upstash** (free tier). **Backend hosting → Render** (free tier). **Admin web → Vercel** (unchanged from original plan).
2. **Twilio/SMS is removed entirely.** Emergency contacts must now be existing FamShare users (`contact_user_id` is `NOT NULL`), and SOS delivery goes through FCM push only. This is a real schema and API change, not just a config swap — read `docs/02-database-schema.md`'s updated `emergency_contacts` table and `docs/03-api-endpoints.md`'s updated Emergency Contacts section before touching that module.

## Task 1: Database migration to Supabase

- I will provide the Supabase project's connection string (`DATABASE_URL`) and confirm the PostGIS extension is enabled on that project — do not attempt to create a Supabase project yourself; ask me for the connection string if it's not already in your environment
- Run all existing migrations (Sprints 1–3: `users`, `refresh_tokens`, `admins`, `follows`, `circles`, `circle_members`, `locations`) against the Supabase database
- Confirm the GIST index on `locations.geom` was created successfully — Supabase's PostGIS setup can occasionally need the extension enabled explicitly per-schema, verify rather than assume
- Local Docker Postgres remains the local-dev database — do not remove `infra/docker-compose.yml`'s postgres service. Only the deployed backend (Render) points at Supabase; local dev is unchanged.

## Task 2: Redis migration to Upstash

- I will provide the Upstash `REDIS_URL` — ask if it's not already available
- Update `realtime/redis-pubsub.ts` and the BullMQ queue setup to work against Upstash. Note: Upstash's free tier has a request/command budget — check whether Upstash's TLS/TCP endpoint (not just their REST API) is what you're connecting to, since BullMQ and standard Redis Pub/Sub need a persistent connection, not a REST-per-command pattern. Confirm which mode you're using and why.
- Local Docker Redis remains for local dev, same pattern as the database

## Task 3: Remove Twilio, update emergency contacts + SOS delivery

- Delete `apps/backend/src/lib/twilio.ts` and remove `TWILIO_*` from `.env.example` and the zod env schema
- Update the `emergency_contacts` migration/table: `contact_user_id` becomes `NOT NULL`, drop the `name` column (display name comes from the referenced user's profile instead), keep `phone` but mark it informational-only in a code comment
- Update `modules/emergency-contacts/`: `POST /emergency-contacts` now takes `{ contactUsername }`, resolves it to an existing user, and rejects (400) if the username doesn't exist — no more free-text name+phone contact creation
- Update `queue/sos.worker.ts`: remove the Twilio SMS step entirely, keep only the FCM push step, still with retry/backoff on failure
- If any Sprint-1-through-3 tests reference the old emergency-contacts shape, update them to match

## Task 4: Deploy backend to Render

- I will connect the Render service to the GitHub repo — you don't need to create the Render account or service, but you should prepare whatever Render needs from the repo side (a `render.yaml` if you want Infrastructure-as-Code, or confirm the existing `infra/Dockerfile.backend` is what Render should build from)
- Set up the environment variables Render needs (list them out for me to enter into Render's dashboard — do not attempt to set them yourself): `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_JWT_SECRET`, `FCM_SERVICE_ACCOUNT_JSON`, `SENTRY_DSN`, `NODE_ENV=production`, `PORT`
- Confirm the WebSocket gateway works correctly behind Render's infrastructure — Render supports WebSockets on web services, but confirm there's no additional config needed (e.g., sticky sessions aren't a concern at single-instance scale, but double check Render doesn't require any special header/proxy handling for `wss://`)

## Task 5: Supabase keep-alive

- Add a new GitHub Actions workflow (`.github/workflows/keep-alive.yml`) on a schedule (e.g., every 3 days) that sends a request to the deployed backend's `GET /health` endpoint — this prevents Supabase's free-tier 7-day inactivity pause
- Confirm the workflow is scheduled correctly (`cron` syntax) and does not require secrets beyond the backend's public URL

## Task 6: Verify Sprint 3 functionality still works against the new stack

Re-run the Sprint 3 verification checklist, but this time against Supabase + Upstash + the Render-deployed backend, not local Docker:
- [ ] Two accounts in the same circle still see live location updates via the deployed backend
- [ ] Cross-circle isolation still holds
- [ ] WS reconnection still works when hitting the Render-deployed backend (this is a new variable — Render's cold start after idle means the *first* reconnect attempt after inactivity may need to survive a 30-60s delay; confirm the mobile client's backoff logic tolerates this rather than giving up)
- [ ] REST fallback (`POST /locations`) works against the deployed backend
- [ ] Rate limiting still functions correctly
- [ ] Confirm PostGIS spatial queries (the GIST-indexed `geom` column) perform correctly on Supabase, not just on local Postgres

## Constraints
- Do not create any Supabase, Upstash, or Render accounts/projects yourself — I'll provide credentials/connection strings for services I've already set up, or tell you if I need you to wait while I create one
- Do not add back any SMS/Twilio code path "just in case" — it's a deliberate removal, not a temporary gap
- Local development via Docker Compose must continue to work unchanged — this migration only affects what the deployed backend connects to
- After finishing, report which of Task 1–6's items are confirmed working versus which still need me to take an action (e.g., entering env vars into Render's dashboard, which you can't do yourself)
