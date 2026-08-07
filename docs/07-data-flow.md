# 07 — Data Flow

## Purpose
Traces the full path of data through the system for the highest-value user journeys, tying together auth (06), realtime channels (05), API endpoints (03), and schema (02) into concrete end-to-end sequences.

---

## Journey 1: Location Update (steady-state sharing)

```
Flutter app (background service)
  → detects motion-adaptive GPS fix
  → sends { lat, lng, speed, batteryLevel } over open WS connection (location:update)
    ↓
WS Gateway
  → validates JWT on connection (already authenticated at connect time)
  → rate-limit check (per-user, per-interval)
  → writes row to `locations` table (geography Point)
  → [Tier 1] checks new position against active `geofences` for the user's circles via ST_DWithin
      → if entered/exited a geofence, emits a separate geofence:event (push notification path)
  → publishes location:broadcast to Redis channel `circle:{circleId}:location`
    ↓
Redis Pub/Sub
  → fans out to all backend instances subscribed to that circle channel
    ↓
WS Gateway (any instance)
  → relays location:broadcast to connected clients (circle members' mobile apps, admin web if subscribed)
    ↓
Flutter app (recipient)
  → updates the pin position for that user on the live map, no full re-fetch
```

**Failure mode handling:** if the WS send fails client-side, the mobile app falls back to `POST /locations` (REST) on its next opportunity so location data isn't silently lost during a flaky connection — though real-time broadcast to others is naturally delayed until reconnection.

---

## Journey 2: SOS Trigger (highest-priority path)

```
User taps SOS button in Flutter app
  → app immediately attempts BOTH:
      (a) WS message: sos:trigger { lat, lng }
      (b) REST fallback: POST /sos { lat, lng }  [fires if WS unavailable, or as a safety-net]
    ↓
Backend (whichever path lands first is processed; second is deduplicated)
  → writes `sos_events` row, status = 'active'
  → SYNCHRONOUSLY publishes sos:broadcast to:
      - circle:{circleId}:sos  (circle members see it instantly on their map/UI)
      - admin:sos              (admin dashboard live feed updates instantly)
  → SEPARATELY enqueues a BullMQ job: { sosEventId, userId }
    ↓
BullMQ Worker (async, does not block the above)
  → fetches user's emergency_contacts, ordered by priority (all are FindFam users — see 00-master-project-reference.md cost/scope decision, free-tier MVP has no SMS path for non-app contacts)
  → sends FCM push to each contact (with live map link)
  → retries with backoff on delivery failure
  → [optional] re-sends at an interval if the SOS remains unresolved after N minutes
    ↓
Admin dashboard
  → live SOS feed shows the event immediately (via admin:sos WS subscription)
  → admin can view live location updates for that user (still streaming — SOS keeps location active regardless of the user's normal sharing toggle)
    ↓
Resolution
  → user taps "I'm safe" in-app → PATCH /sos/:id/resolve → status = 'resolved' → sos:resolved broadcast
  → OR admin marks resolved from the dashboard (audit-logged with which admin resolved it)
```

**Design intent:** the WS broadcast (instant, "people watching now") and the queue-based delivery (guaranteed, "people who need to be reached regardless") are intentionally decoupled — see 05-realtime-channels for the rationale.

---

## Journey 3: Chat Message

```
User sends message in a circle chat
  → WS message: message:send { circleId, content }
    ↓
Backend
  → validates sender is a member of that circle (circle_members lookup)
  → writes to `messages` table
  → publishes message:broadcast to circle:{circleId}:chat
    ↓
Redis Pub/Sub → fan-out → connected circle members receive instantly
    ↓
For circle members with no open WS connection:
  → backend sends an FCM data message → triggers a local notification
  → message is still retrievable via GET /circles/:id/messages when they next open the app
```

---

## Journey 4: New Member Joins a Circle

```
Owner sends invite: POST /circles/:id/members { username }
  → backend validates owner permission, looks up user by username
  → inserts circle_members row
  → [optional MVP+] sends FCM notification to the new member: "You've been added to {circleName}"
    ↓
New member's app
  → on next open (or push-triggered refresh), fetches GET /circles → sees new circle
  → subscribes to that circle's WS channels (location, chat, sos) on next WS (re)connect
```

---

## Journey 5: Admin Moderation Action

```
Admin views GET /admin/users?search=... in Next.js dashboard
  → selects a user, triggers PATCH /admin/users/:id/suspend
    ↓
Backend
  → sets a suspended flag on the user (or revokes all their refresh tokens + blocks login)
  → [recommended] logs the action: admin_id, target_user_id, action, timestamp (simple audit table, not in original schema — add if moderation actions ship)
    ↓
Suspended user's app
  → next API call returns 403 → app forces logout, shows "account suspended" state
  → WS connections for that user are force-disconnected server-side
```

## Cross-Cutting Notes
- **Every write path that touches location or SOS data should be treated as high-sensitivity** — this is personal safety data, not generic app data. Favor explicit, auditable code paths over clever abstractions here.
- **Idempotency:** SOS trigger and location updates should tolerate duplicate sends (client retries, network blips) without creating duplicate rows or duplicate notifications — dedupe on a short time window server-side.
