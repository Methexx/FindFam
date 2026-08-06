# 00 — Master Project Reference

## Project Name
**FamShare** (working name) — a live location sharing app for families/relatives with safety features.

## One-Line Description
A privacy-first, consent-based live location sharing app that lets circles of relatives see each other on a live map, chat, and trigger an SOS alert that shares live location with emergency contacts — built solo, mobile + backend + admin web.

## Problem Statement
Existing family location-sharing apps (Life360) dominate the market but are widely distrusted — they've sold user location data to data brokers, suffered a data breach, and been hit with an FTC order for selling sensitive location data. Apple Find My and Google Family Link are platform-locked and feature-limited. Zenly, the most-loved app in this space for its social/emotional design, was shut down in 2023 despite 35-40M users — not from lack of demand, but because its parent company (Snap) couldn't monetize it. This leaves a gap for a cross-platform, consent-first, non-invasive family safety app.

## Target Users
- Families wanting mutual, symmetric location visibility (not one-way parent-surveils-child)
- Relatives who want a lightweight safety net (SOS) without a subscription-gated "safety-services" product
- Users who specifically distrust Life360's data practices

## Core Positioning
"The app Zenly users wanted, without the Life360 baggage" — private, consent-first, transparent, warm/social UX, safety features free rather than paywalled.

## Roles (3)
| Role | Platform | Purpose |
|---|---|---|
| **User (relative/family member)** | Flutter mobile | Share location, join circles, chat, manage emergency contacts, trigger SOS |
| **Admin** | Next.js web | Moderate users/circles, monitor live SOS events, view analytics |
| *(No separate "child" role in MVP — symmetric sharing model, not parental control)* | | |

## Tech Stack
- **Mobile:** Flutter (iOS + Android)
- **Backend:** Node.js + Fastify (TypeScript)
- **Admin Web:** Next.js + shadcn/ui + Tailwind
- **Database:** PostgreSQL + PostGIS via **Supabase** (free tier — 500MB, PostGIS enabled)
- **Realtime:** WebSocket (location broadcast + chat), Redis Pub/Sub (fan-out if scaled)
- **Queue:** Redis + BullMQ (SOS delivery retries) via **Upstash** (free tier)
- **Push:** Firebase Cloud Messaging (FCM) — sole SOS delivery channel (see scope decision below)
- **Auth:** JWT (7-day refresh pattern), argon2id password hashing
- **Repo structure:** Monorepo (Turborepo)
- **Deploy:** Backend → **Render** (free tier); Admin web → **Vercel** (free tier); Mobile → CI-built APK/IPA, distributed via Google Play **Closed Testing** track
- **DevOps:** Docker + Docker Compose (local dev only), GitHub Actions (CI/CD), Sentry (error tracking)

## Cost & Scope Decision (locked — August 2026)
FamShare's MVP runs entirely on free tiers with **zero recurring paid services**. The only real cost is Google Play's one-time $25 developer registration fee (already covered), which is a one-time store fee, not a recurring service. This drove one scope change:
- **Emergency contacts must be existing FamShare users.** Twilio SMS (for non-app contacts) is dropped from the free-tier MVP — SOS delivery goes through FCM push only. External phone-only contacts with SMS delivery are a possible future paid-tier feature, not part of this build.
- Supabase free-tier projects pause after 7 days of zero API activity — mitigated with a scheduled GitHub Actions health-check ping (see 10-production-readiness.md).
- Render's free backend tier spins down after 15 minutes idle (30–60s cold start on the next request) — a known, accepted limitation for a limited-user closed test, not something to engineer around on the free tier.

## Monorepo Structure (reference — full detail in 08-flutter-app-structure and 04-backend-structure)
```
famshare/
├── apps/
│   ├── mobile/              # Flutter app
│   ├── backend/             # Fastify (TypeScript)
│   └── admin-web/           # Next.js
├── packages/
│   ├── shared-types/        # TS types shared between backend + admin-web
│   └── config/              # shared eslint/tsconfig
├── infra/
│   ├── docker-compose.yml
│   ├── Dockerfile.backend
│   └── Dockerfile.admin-web
├── .github/workflows/
│   ├── backend-ci.yml
│   ├── admin-web-ci.yml
│   └── mobile-ci.yml
└── turbo.json
```

## Feature Scope Summary
Full detail lives in the standalone feature list, but the phased summary is:

- **MVP:** Auth (username-based), circles (create/join/leave/delete), live location sharing + map, circle-scoped chat, emergency contacts, SOS button (location + push + SMS), admin dashboard (users, circles, SOS monitoring)
- **Tier 1 (post-MVP):** Persistent sharing indicator, pause/ghost mode, battery/speed/time-at-place display, geofence place alerts
- **Tier 2:** Location history + playback, Footprints-style personal place map, expressive chat, temporary share links
- **Tier 3 (optional):** Driving reports, silent SOS variants, crash detection
- **Out of scope:** 24/7 emergency dispatch, roadside assistance, insurance/reimbursement products, automated 911 dispatch

## Key Product Decisions (locked)
- **Symmetric sharing only** — no one-way "track my child" surveillance mode in MVP
- **Consent-first** — no stealth install, persistent "you are sharing" indicator required from Tier 1 onward
- **SOS routes to emergency contacts + admin dashboard, never to real emergency services directly** — app is not a substitute for calling emergency services, and this must be disclaimed in-app
- **No data selling** — explicit product/privacy stance, differentiator vs. Life360
- **One admin role** in MVP — no granular permission tiers yet

## Document Index
| Doc | Purpose |
|---|---|
| 00-master-project-reference | This document |
| 01-system-architecture | High-level architecture, component diagram, data flow overview |
| 02-database-schema | Full Postgres/PostGIS schema, tables, relationships, indexes |
| 03-api-endpoints | REST/WebSocket endpoint reference for backend |
| 04-backend-structure | Fastify project structure, folder layout, conventions |
| 05-realtime-channels | WebSocket/Redis Pub/Sub design for location + chat + SOS |
| 06-auth-flow | Auth, JWT, session, and admin-auth flow |
| 07-data-flow | End-to-end data flow for key user journeys (location update, SOS trigger, chat message) |
| 08-flutter-app-structure | Flutter project structure, state management approach |
| 09-sprint-timeline | Sprint-by-sprint build plan, including file/repo structure setup timing |
| 10-production-readiness | Pre-launch checklist: security, DevOps, monitoring, legal/privacy |

## Realistic Timeline
Solo build, part-time alongside coursework: **10–12 weeks** for MVP through Tier 1, based on your School Connect build pace. Full detail in 09-sprint-timeline.
