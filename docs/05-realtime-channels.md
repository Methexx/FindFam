# 05 — Realtime Channels

## Purpose
Defines how location updates, chat messages, and SOS events flow in real time between mobile clients, the backend, and the admin dashboard.

## Transport
- **WebSocket** (`@fastify/websocket`) for all three real-time features in MVP — one gateway, multiple logical channels multiplexed over each connection.
- **Redis Pub/Sub** as the fan-out backplane. Even at single-instance scale in MVP, every publish goes through Redis rather than being broadcast directly in-process — this means scaling to multiple backend instances later requires zero changes to the broadcast logic.

## Connection Lifecycle
1. Client opens WS connection to `wss://api.famshare.app/ws`
2. Client sends an initial `auth` message containing the JWT access token
3. Server verifies the token, resolves the user's circle memberships, and subscribes the connection to Redis channels: `circle:{circleId}:location`, `circle:{circleId}:chat`, `circle:{circleId}:sos` for each circle
4. Server also subscribes admin connections to `admin:sos` (global SOS feed) after admin-token verification
5. On disconnect, server unsubscribes and cleans up Redis subscriptions for that connection

## Channel Design

### Location channel — `circle:{circleId}:location`
- **Publish trigger:** client sends `location:update` → server validates (rate limit check, geofence containment check if Tier 1 is live) → writes to `locations` table → publishes `location:broadcast` to the circle's Redis channel
- **Fan-out:** every server instance subscribed to that circle relays the message to its locally-connected clients
- **Payload:** `{ userId, lat, lng, speed, batteryLevel, recordedAt }`
- **Client behavior:** update the pin position on the live map for that user; do not re-fetch the whole circle's state on every update

### Chat channel — `circle:{circleId}:chat`
- **Publish trigger:** client sends `message:send` → server writes to `messages` table → publishes `message:broadcast`
- **Payload:** `{ id, circleId, senderId, content, sentAt }`
- **Delivery for offline members:** if a circle member has no open WS connection, they receive the message via FCM push (silent/data message that triggers a local notification) rather than losing it — message history is still fetchable via `GET /circles/:id/messages` on next open

### SOS channel — `circle:{circleId}:sos` + `admin:sos`
- **Publish trigger:** client sends `sos:trigger` → server immediately writes an `sos_events` row (`status: active`) → publishes `sos:broadcast` to both the circle channel and the global `admin:sos` channel **synchronously**, before anything else happens
- **Separately, enqueues a BullMQ job** for guaranteed-delivery notification (FCM push to emergency contacts — free-tier MVP has no SMS path, see 00-master-project-reference.md) — this is decoupled from the WS broadcast specifically so that a queue/worker failure never delays or blocks the real-time alert to the circle and admin dashboard
- **Resolution:** `sos:resolved` broadcast when the triggering user or an admin marks the event resolved

## Why WS broadcast and queue delivery are split
The WS broadcast is for **people already watching** (circle members with the app open, admin dashboard). The queue is for **guaranteed delivery to emergency contacts**, who may not have the app open at all and need push + SMS with retries. Conflating these into one code path would mean a slow SMS provider could delay the instant in-app alert, which is unacceptable for a safety feature.

## Reconnection Handling (mobile)
- Exponential backoff reconnect on WS drop (common on mobile — tunnels, backgrounding, network switches)
- On reconnect, client re-sends `auth`, re-subscribes, and calls `GET /circles/:id/locations/latest` + `GET /circles/:id/messages` to reconcile any state missed while disconnected
- SOS trigger should **not** depend on an open WS connection succeeding — `POST /sos` (REST) is the reliable fallback path if the WS send fails; mobile client should attempt both and treat either success as sufficient

## Scaling Path (not needed for MVP, documented for later)
- Redis Pub/Sub already isolates broadcast logic from the number of backend instances
- If a single Fastify process becomes a bottleneck, run multiple WS-handling instances behind a load balancer with sticky sessions (or none needed, since Redis Pub/Sub means any instance can serve any client)
- Consider MQTT instead of raw WebSocket only if mobile battery/bandwidth profiling shows WS overhead is a real problem — not a Phase 1 concern
