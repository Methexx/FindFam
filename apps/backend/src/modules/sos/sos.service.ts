import * as sosRepository from './sos.repository';
import * as circlesRepository from '../circles/circles.repository';
import { redisPubSub } from '../../realtime/redis-pubsub';
import { enqueueSosDelivery } from '../../queue/sos.queue';

export class SosError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

// Window within which a second SOS trigger from the same user is treated as
// a duplicate of an already-active event rather than a new one — covers the
// WS+REST dual-send race from a single button tap (docs/07-data-flow.md
// Journey 2) without silently swallowing a genuine second SOS minutes later.
const DEDUP_WINDOW_MS = 30_000;

function toPublicSosEvent(row: sosRepository.SosEventRow) {
  return {
    id: row.id,
    userId: row.user_id,
    origin: { lat: row.lat, lng: row.lng },
    status: row.status,
    triggeredAt: row.triggered_at.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
  };
}

async function broadcastSosEvent(type: 'sos:broadcast' | 'sos:resolved', event: ReturnType<typeof toPublicSosEvent>, circleIds: string[]) {
  await Promise.all([
    ...circleIds.map((circleId) =>
      redisPubSub.publish(`circle:${circleId}:sos`, JSON.stringify({ type, payload: event })),
    ),
    redisPubSub.publish('admin:sos', JSON.stringify({ type, payload: event })),
  ]);
}

export async function triggerSos(userId: string, input: { lat: number; lng: number }) {
  const existing = await sosRepository.findRecentActiveEvent(userId, DEDUP_WINDOW_MS);
  if (existing) {
    // Second of a WS+REST dual-send (or a rapid re-tap) — return the
    // already-active event rather than creating a duplicate row,
    // re-broadcasting, or re-enqueueing a second delivery job.
    return toPublicSosEvent(existing);
  }

  const row = await sosRepository.insertSosEvent({
    userId,
    lat: input.lat,
    lng: input.lng,
    triggeredAt: new Date(),
  });
  const event = toPublicSosEvent(row);

  // Synchronous broadcast first — this is what people already watching
  // (circle members, admin dashboard) see instantly. Queueing for
  // guaranteed delivery to emergency contacts happens only after, and its
  // failure must never affect this response (see docs/05-realtime-channels.md
  // for why the two paths are deliberately decoupled).
  const circles = await circlesRepository.listCirclesForUser(userId);
  const circleIds = circles.map((circle) => circle.id);
  await broadcastSosEvent('sos:broadcast', event, circleIds);

  try {
    await enqueueSosDelivery({ sosEventId: event.id, userId });
  } catch (err) {
    console.error('[sos.service] failed to enqueue SOS delivery job:', err);
  }

  return event;
}

export async function resolveSos(userId: string, sosEventId: string) {
  const existing = await sosRepository.findEventById(sosEventId);
  if (!existing) {
    throw new SosError('SOS event not found', 404);
  }
  if (existing.user_id !== userId) {
    throw new SosError('Only the user who triggered this SOS can resolve it', 403);
  }
  if (existing.status !== 'active') {
    throw new SosError('This SOS event has already been resolved', 409);
  }

  const row = await sosRepository.resolveEvent(sosEventId, 'resolved', new Date());
  const event = toPublicSosEvent(row);

  const circles = await circlesRepository.listCirclesForUser(userId);
  await broadcastSosEvent('sos:resolved', event, circles.map((circle) => circle.id));

  return event;
}

export async function listActiveForUserCircles(userId: string) {
  const circles = await circlesRepository.listCirclesForUser(userId);
  const memberLists = await Promise.all(
    circles.map((circle) => circlesRepository.listMembers(circle.id)),
  );
  const userIds = Array.from(new Set(memberLists.flat().map((member) => member.user_id)));

  const rows = await sosRepository.listActiveEventsForUsers(userIds);
  return rows.map(toPublicSosEvent);
}
