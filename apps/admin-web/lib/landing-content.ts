// Content for the public landing page at `/`.
//
// Kept as data rather than JSX so the page component stays a thin composition
// layer. Every journey below traces a real code path — the endpoints, channel
// names and payload shapes match docs/03-api-endpoints.md, docs/05-realtime-
// channels.md and docs/07-data-flow.md. If the API changes, this file changes
// with it.

export interface JourneyStep {
  actor: string;
  title: string;
  detail: string;
  // Optional wire-level example: the actual request, WS frame or SQL involved.
  example?: { label: string; code: string };
  // Marks a step whose implementation is still in flight, so the page never
  // claims something works that doesn't.
  status?: string;
}

export interface Journey {
  id: string;
  eyebrow: string;
  title: string;
  summary: string;
  steps: JourneyStep[];
}

// A single running example threaded through all three journeys, so the page
// reads as one continuous story rather than three disconnected demos.
export const CAST = {
  maya: 'maya_r',
  rob: 'rob_r',
  circle: 'Rodriguez Family',
};

export const JOURNEYS: Journey[] = [
  {
    id: 'connect',
    eyebrow: 'Journey 1',
    title: 'Getting connected',
    summary:
      'Nobody can see your location because they know your username. Sharing requires a follow that you accepted, and then a circle you were added to — two separate consent steps, both of which you control.',
    steps: [
      {
        actor: CAST.maya,
        title: 'Registers an account',
        detail:
          'The password is hashed with argon2id. The response carries a 15-minute access token and a 7-day refresh token — the refresh token is opaque random bytes, stored server-side only as a SHA-256 hash, so it can be revoked.',
        example: {
          label: 'POST /api/v1/auth/register',
          code: `{
  "username": "maya_r",
  "email": "maya@example.com",
  "password": "••••••••"
}

→ 201 { "data": { "user": {...}, "tokens": {...} } }`,
        },
      },
      {
        actor: CAST.maya,
        title: 'Sends a follow request to rob_r',
        detail:
          'The request lands as pending. Nothing is shared yet, and rob_r has to act before anything changes.',
        example: {
          label: 'POST /api/v1/follows',
          code: `{ "followeeUsername": "rob_r" }

→ 201 { "data": { "id": "…", "status": "pending" } }`,
        },
      },
      {
        actor: CAST.rob,
        title: 'Accepts',
        detail:
          'Only the person who received the request can respond to it — anyone else gets a 403. There is a test asserting exactly that.',
        example: {
          label: 'PATCH /api/v1/follows/:id',
          code: `{ "action": "accept" }

→ 200 { "data": { "status": "accepted" } }`,
        },
      },
      {
        actor: CAST.maya,
        title: `Creates the "${CAST.circle}" circle and adds rob_r`,
        detail:
          'Adding a member requires an accepted follow in place first. A stranger cannot add you to their circle to start watching you — the server rejects it, not the UI.',
        example: {
          label: 'POST /api/v1/circles/:id/members',
          code: `{ "username": "rob_r" }

→ 201  — but only because the follow above was accepted.
   Without it: 403.`,
        },
      },
    ],
  },
  {
    id: 'location',
    eyebrow: 'Journey 2',
    title: 'A location update, end to end',
    summary:
      'This is the steady-state path that runs all day, so it is the one that has to be cheap. One open WebSocket per device, a write, a spatial check, and a fan-out — no polling anywhere.',
    steps: [
      {
        actor: CAST.rob,
        title: 'Turns sharing on',
        detail:
          'An explanation screen runs before the OS permission prompt. Android then shows a persistent foreground-service notification for as long as sharing is active — the app cannot track you quietly, by construction.',
      },
      {
        actor: 'Device',
        title: 'Sends a fix over the open socket',
        detail:
          'Sampled roughly every 10 seconds or 20 metres of movement, whichever comes first. Battery level rides along so other members can see when someone is about to go dark.',
        example: {
          label: 'WebSocket → /ws',
          code: `{
  "type": "location:update",
  "payload": {
    "lat": 6.9271, "lng": 79.8612,
    "speed": 1.4, "batteryLevel": 72
  }
}`,
        },
      },
      {
        actor: 'Gateway',
        title: 'Validates, rate-limits, writes',
        detail:
          'Capped at 30 updates per minute per connection. The row is stored as a PostGIS geography point, not a pair of floats, which is what makes the next step a single indexed query instead of hand-rolled distance maths.',
        example: {
          label: 'PostgreSQL + PostGIS',
          code: `INSERT INTO locations (user_id, geom, speed, battery_level)
VALUES ($1, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography, $4, $5)`,
        },
      },
      {
        actor: 'Gateway',
        title: 'Checks the new position against active geofences',
        detail:
          'One ST_DWithin per circle. Crossing into a saved place — school, home, work — emits a separate geofence:event rather than being inferred on the client.',
        example: {
          label: 'Containment check',
          code: `ST_DWithin(center, ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography, radius_meters)`,
        },
      },
      {
        actor: 'Redis',
        title: 'Fans the update out to the circle',
        detail:
          'Pub/Sub sits between the gateway and its subscribers even though a single backend instance would not strictly need it. It is cheap to put in now and expensive to retrofit the day a second instance exists.',
        example: {
          label: 'Channel',
          code: `circle:{circleId}:location`,
        },
      },
      {
        actor: CAST.maya,
        title: "Sees rob_r's pin move",
        detail:
          'The client moves one marker from the broadcast payload. No re-fetch, no list reload. If the socket is down, the device falls back to POST /locations so the data is never lost — only the live broadcast waits for reconnection.',
        example: {
          label: 'WebSocket ← /ws',
          code: `{
  "type": "location:broadcast",
  "payload": { "userId": "…", "lat": 6.9271, "lng": 79.8612, … }
}`,
        },
      },
    ],
  },
  {
    id: 'sos',
    eyebrow: 'Journey 3',
    title: 'An SOS, and why it takes two paths',
    summary:
      'The safety-critical path. Two things must be true at once: circle members watching right now should see it instantly, and emergency contacts must be reached whether or not they happen to have the app open. Those are different reliability problems, so they get different mechanisms.',
    steps: [
      {
        actor: CAST.maya,
        title: 'Holds the SOS button',
        detail:
          'A confirmation step guards against pocket-triggers, and it carries the disclaimer every time rather than burying it in settings: this is not a substitute for calling emergency services.',
      },
      {
        actor: 'App',
        title: 'Fires the WebSocket and the REST call together',
        detail:
          'Not one with the other as a fallback — both, concurrently. Either landing is sufficient. A panic button is the wrong place to find out your socket was half-open.',
        example: {
          label: 'Both, at once',
          code: `WS   { "type": "sos:trigger", "payload": { "lat": …, "lng": … } }
REST POST /api/v1/sos   { "lat": …, "lng": … }`,
        },
      },
      {
        actor: 'Backend',
        title: 'Writes one event, not two',
        detail:
          'A 30-second dedup window means the deliberate double-send collapses into a single sos_events row. Note what is deliberately missing here: there is no rate limit on SOS. Throttling a panic button is the wrong trade, so it dedupes instead.',
      },
      {
        actor: 'Backend',
        title: 'Broadcasts instantly, on two channels',
        detail:
          'Synchronous, before anything slower happens. Circle members see it on their map; the admin dashboard live feed updates in the same moment.',
        example: {
          label: 'Channels',
          code: `circle:{circleId}:sos   → the family
admin:sos               → the moderation dashboard`,
        },
      },
      {
        actor: 'Queue',
        title: 'Separately enqueues delivery',
        detail:
          'A BullMQ job, decoupled from the broadcast above. "The SOS was raised" must be instant and must never be lost; "the notification was delivered" may need retries. Conflating them makes the fast path as slow as the slow path.',
        example: {
          label: 'BullMQ — queue "sos-delivery"',
          code: `{ sosEventId, userId }
attempts: 5, backoff: exponential from 2s`,
        },
      },
      {
        actor: 'Worker',
        title: 'Pushes to each emergency contact by priority',
        detail:
          'The worker resolves the contact list and sends a push per contact, retrying with backoff. A single dead device token never blocks delivery to the rest of the list.',
        status: 'Delivery lands in Sprint 7',
        example: {
          label: 'Firebase Cloud Messaging',
          code: `for each contact, ordered by priority
  → send push (title, body, deep link to the live map)`,
        },
      },
      {
        actor: CAST.maya,
        title: 'Marks herself safe',
        detail:
          'Resolution broadcasts back out on the same channels, so every watching client and the admin feed clear together.',
        example: {
          label: 'PATCH /api/v1/sos/:id/resolve',
          code: `→ 200, then sos:resolved on circle:{id}:sos and admin:sos`,
        },
      },
    ],
  },
];

export interface Surface {
  name: string;
  role: string;
  stack: string;
  points: string[];
}

export const SURFACES: Surface[] = [
  {
    name: 'Mobile app',
    role: 'What families actually use',
    stack: 'Flutter · Riverpod · flutter_map',
    points: [
      'Background location capture with a visible foreground-service notification',
      'Live circle map, chat, SOS, emergency contacts',
      'Tokens in platform secure storage, with a queued refresh interceptor',
    ],
  },
  {
    name: 'Backend',
    role: 'One service, three responsibilities',
    stack: 'Fastify · TypeScript · Kysely',
    points: [
      'REST API — 43 routes across 9 modules',
      'WebSocket gateway for location, chat and SOS',
      'BullMQ worker for SOS delivery with retries',
    ],
  },
  {
    name: 'Admin dashboard',
    role: 'Moderation and monitoring',
    stack: 'Next.js · React Server Components',
    points: [
      'Live SOS feed over its own WebSocket channel',
      'User search, suspend and unsuspend, with an audit trail',
      'Auth kept entirely separate from user accounts',
    ],
  },
];

export interface DecisionNote {
  title: string;
  body: string;
}

export const DECISIONS: DecisionNote[] = [
  {
    title: 'PostGIS, not distance maths in application code',
    body: 'Locations are stored as geography points with a GIST index. Geofence containment is one ST_DWithin per circle — an indexed spatial query rather than a loop over rows computing haversine distances.',
  },
  {
    title: 'Redis Pub/Sub from day one',
    body: 'A single backend instance does not need a fan-out backplane. But adding one later means rewriting every broadcast path, so the pattern is in place before it is needed rather than after.',
  },
  {
    title: 'A queue specifically for SOS',
    body: 'Everything else calls its dependencies directly. SOS is the one path where an unretried call to an external service would be a single point of failure on the feature that matters most.',
  },
  {
    title: 'Two JWT secrets, not one',
    body: 'User and admin tokens are signed with different secrets, so a leaked user token cannot reach an admin route even in principle. Tests assert the rejection in both directions.',
  },
  {
    title: 'Suspension takes effect on the next request',
    body: 'Auth does a database check per request rather than trusting the token for its full 15 minutes. Suspending someone also closes their live socket and revokes their refresh tokens, so moderation is immediate rather than eventual.',
  },
  {
    title: 'Sharing status is impossible to hide',
    body: 'Android shows a persistent notification whenever capture is running, and the app carries its own always-visible indicator. A location app that can track you quietly is the thing this one is positioned against.',
  },
];
