# 03 — API Endpoints

## Conventions
- Base URL: `/api/v1`
- Auth: `Authorization: Bearer <jwt>` header on all endpoints except `register`/`login`
- Admin endpoints prefixed `/api/v1/admin`, require admin JWT (separate token issuer — see 06-auth-flow)
- All responses: `{ data, error }` shape; errors use standard HTTP status codes
- Pagination: `?cursor=<id>&limit=20` on list endpoints

---

## Auth

| Method | Path | Description |
|---|---|---|
| POST | `/auth/register` | Create account — username, email, phone, password |
| POST | `/auth/login` | Returns access + refresh token |
| POST | `/auth/refresh` | Exchange refresh token for new access token |
| POST | `/auth/logout` | Invalidate refresh token |
| GET | `/auth/me` | Current user profile |
| PATCH | `/auth/me` | Update profile (avatar, phone) |

## Follows

| Method | Path | Description |
|---|---|---|
| POST | `/follows` | Send follow request (`{ followee_username }`) |
| PATCH | `/follows/:id` | Accept / reject a pending follow request |
| DELETE | `/follows/:id` | Unfollow / remove follower |
| GET | `/follows/pending` | List incoming pending requests |
| GET | `/follows` | List accepted follows (following + followers) |

## Circles

| Method | Path | Description |
|---|---|---|
| POST | `/circles` | Create circle |
| GET | `/circles` | List circles current user belongs to |
| GET | `/circles/:id` | Circle details + member list |
| PATCH | `/circles/:id` | Update circle name (owner only) |
| DELETE | `/circles/:id` | Delete circle (owner only) |
| POST | `/circles/:id/members` | Add member by username (owner only) |
| DELETE | `/circles/:id/members/:userId` | Remove member (owner) or leave (self) |

## Location

| Method | Path | Description |
|---|---|---|
| POST | `/locations` | Submit a location update (`{ lat, lng, speed, battery_level }`) — rate-limited |
| GET | `/circles/:id/locations/latest` | Latest known location for every member of a circle |
| GET | `/locations/history?from=&to=` | Own location history (Tier 2) |
| PATCH | `/locations/sharing-status` | Toggle sharing on/off globally or per-circle (Tier 1) |

> Note: real-time delivery of location updates happens over the WebSocket gateway, not by polling this REST endpoint. `POST /locations` is the ingest path; the WS gateway is the broadcast path. See 05-realtime-channels.

## Geofences (Tier 1)

| Method | Path | Description |
|---|---|---|
| POST | `/circles/:id/geofences` | Create a place alert zone |
| GET | `/circles/:id/geofences` | List geofences for a circle |
| DELETE | `/geofences/:id` | Remove a geofence |

## Chat

| Method | Path | Description |
|---|---|---|
| GET | `/circles/:id/messages?cursor=&limit=` | Paginated message history |
| POST | `/circles/:id/messages` | Send message (also emitted over WS in real time) |

## Emergency Contacts

| Method | Path | Description |
|---|---|---|
| POST | `/emergency-contacts` | Add contact — `contactUsername` required, must resolve to an existing FamShare user (see 00-master-project-reference.md cost/scope decision — free-tier MVP has no SMS path for non-app contacts) |
| GET | `/emergency-contacts` | List own contacts |
| PATCH | `/emergency-contacts/:id` | Update (priority only — the contact identity itself isn't editable, remove and re-add instead) |
| DELETE | `/emergency-contacts/:id` | Remove |

## SOS

| Method | Path | Description |
|---|---|---|
| POST | `/sos` | Trigger SOS (`{ lat, lng }`) — enqueues delivery job, broadcasts over WS |
| PATCH | `/sos/:id/resolve` | Mark own SOS event resolved / cancel |
| GET | `/sos/active` | Any active SOS events involving the current user's circles |

## Admin

| Method | Path | Description |
|---|---|---|
| POST | `/admin/auth/login` | Admin login (separate credential store) |
| GET | `/admin/users?cursor=&search=` | List/search users |
| PATCH | `/admin/users/:id/suspend` | Suspend a user account |
| PATCH | `/admin/users/:id/unsuspend` | Restore a user account |
| GET | `/admin/circles?cursor=&search=` | List/search circles |
| GET | `/admin/circles/:id` | Circle detail + members (moderation view) |
| GET | `/admin/sos/active` | Live feed of active SOS events (also available via WS) |
| GET | `/admin/sos/:id` | SOS event detail, including resolution history |
| GET | `/admin/analytics/summary` | Active users, circles created, SOS events over time |

---

## WebSocket Channels (detail in 05-realtime-channels)

| Event | Direction | Payload |
|---|---|---|
| `location:update` | client → server | `{ lat, lng, speed, battery_level }` |
| `location:broadcast` | server → clients | `{ userId, lat, lng, speed, battery_level, recordedAt }` |
| `message:send` | client → server | `{ circleId, content }` |
| `message:broadcast` | server → clients | `{ id, circleId, senderId, content, sentAt }` |
| `sos:trigger` | client → server | `{ lat, lng }` |
| `sos:broadcast` | server → clients (circle + admin) | `{ id, userId, lat, lng, triggeredAt }` |
| `sos:resolved` | server → clients | `{ id, resolvedAt }` |

## Rate Limiting
- `POST /locations` and `location:update` (WS): capped per-user (e.g. max 1 update per 5–10 seconds under normal conditions, tighter caps configurable)
- `POST /sos`: not rate-limited (safety-critical), but duplicate triggers within a short window should be deduplicated server-side rather than rejected
- Auth endpoints: standard brute-force protection (rate limit by IP + username)
