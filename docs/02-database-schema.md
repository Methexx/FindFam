# 02 — Database Schema

## Engine
PostgreSQL with the **PostGIS** extension enabled (`CREATE EXTENSION IF NOT EXISTS postgis;`).

## Entity Relationship Overview
```
USERS ||--o{ FOLLOWS : follows
USERS ||--o{ CIRCLES : owns
CIRCLES ||--o{ CIRCLE_MEMBERS : has
USERS ||--o{ CIRCLE_MEMBERS : joins
CIRCLES ||--o{ MESSAGES : contains
USERS ||--o{ MESSAGES : sends
USERS ||--o{ EMERGENCY_CONTACTS : sets
USERS ||--o{ SOS_EVENTS : triggers
USERS ||--o{ LOCATIONS : reports
CIRCLES ||--o{ GEOFENCES : defines
USERS ||--o{ ADMINS : "is (optional)"
```

## Tables

### `users`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | `gen_random_uuid()` |
| username | text, unique, not null | indexed, case-insensitive unique (citext or lower() index) |
| email | text, unique, not null | |
| phone | text, nullable | for SMS fallback / SOS |
| password_hash | text, not null | argon2 or bcrypt |
| avatar_url | text, nullable | |
| is_sharing | boolean, default true | Tier 1 ghost-mode toggle, global default |
| created_at | timestamptz, default now() | |
| updated_at | timestamptz | |

### `follows`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| follower_id | uuid, FK → users.id | |
| followee_id | uuid, FK → users.id | |
| status | text | `pending` \| `accepted` \| `blocked` |
| created_at | timestamptz | |

Unique constraint on `(follower_id, followee_id)`. Index on `followee_id` for "who follows me" queries.

### `circles`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| name | text, not null | |
| owner_id | uuid, FK → users.id | |
| created_at | timestamptz | |
| deleted_at | timestamptz, nullable | soft delete |

### `circle_members`
| Column | Type | Notes |
|---|---|---|
| circle_id | uuid, FK → circles.id | |
| user_id | uuid, FK → users.id | |
| role | text | `owner` \| `member` |
| joined_at | timestamptz | |

Composite PK on `(circle_id, user_id)`.

### `locations`
| Column | Type | Notes |
|---|---|---|
| id | bigserial, PK | high write volume — bigserial not uuid |
| user_id | uuid, FK → users.id | |
| geom | geography(Point, 4326) | **PostGIS column** — lat/lng as geography type |
| speed | real, nullable | meters/sec, for Tier 1 display |
| battery_level | smallint, nullable | 0–100, for Tier 1 display |
| recorded_at | timestamptz, not null | |

Index: `CREATE INDEX ON locations USING GIST (geom);` for spatial queries. Index on `(user_id, recorded_at DESC)` for "latest location per user" lookups. Consider a separate `latest_locations` materialized/denormalized table (one row per user, upserted) to avoid scanning history for the live map — full history stays in `locations` for Tier 2 playback.

### `geofences` (Tier 1)
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| circle_id | uuid, FK → circles.id | |
| name | text | e.g. "Home", "School" |
| center | geography(Point, 4326) | |
| radius_meters | integer | |
| created_by | uuid, FK → users.id | |

Query pattern: `ST_DWithin(locations.geom, geofences.center, geofences.radius_meters)` to detect arrival/departure.

### `messages`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| circle_id | uuid, FK → circles.id | |
| sender_id | uuid, FK → users.id | |
| content | text | |
| sent_at | timestamptz | |

Index on `(circle_id, sent_at DESC)` for chat history pagination.

### `emergency_contacts`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → users.id | the account setting the contact |
| contact_user_id | uuid, FK → users.id, **not null** | must be an existing FamShare user — free-tier MVP requires SOS contacts to be app users, see 00-master-project-reference.md cost/scope decision |
| phone | text, nullable | informational display only in the free tier — no SMS delivery is sent to it |
| priority | smallint, default 1 | order to notify in |

**Note:** the original design allowed a non-app contact identified only by name + phone, with SMS delivery via Twilio. That path is dropped for the free-tier MVP (no paid SMS service) — emergency contacts must be FamShare users so SOS delivery can go entirely through free FCM push. Re-introducing external phone-only contacts with SMS is a candidate future paid-tier feature.

### `sos_events`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| user_id | uuid, FK → users.id | |
| origin | geography(Point, 4326) | location at trigger time |
| status | text | `active` \| `resolved` \| `cancelled` |
| triggered_at | timestamptz | |
| resolved_at | timestamptz, nullable | |

Index on `status` for the admin live-feed query (`WHERE status = 'active'`).

### `admins`
| Column | Type | Notes |
|---|---|---|
| id | uuid, PK | |
| email | text, unique | separate from `users` — admin auth is intentionally isolated |
| password_hash | text | |
| created_at | timestamptz | |

Kept separate from `users` deliberately — an admin account should not double as a regular sharing user, and this keeps the admin-auth blast radius isolated (per 06-auth-flow).

## Indexing Summary (performance-critical)
- `locations`: GIST index on `geom`, btree on `(user_id, recorded_at DESC)`
- `messages`: btree on `(circle_id, sent_at DESC)`
- `circle_members`: composite PK covers both directions of lookup
- `follows`: unique on `(follower_id, followee_id)`, btree on `followee_id`
- `sos_events`: btree on `status`
- `users`: unique index on `username` (case-insensitive) and `email`

## Retention Notes
- `locations` will grow fast (one row per user per update interval). Plan a retention policy before Tier 2 history features ship — e.g., partition by month, or downsample/delete raw points older than N days while keeping a lower-resolution history table for the "Footprints" feature.
- `sos_events` and `messages` should not be auto-deleted — these are the records most likely to matter for trust, moderation, or (in a worst case) legal review.
