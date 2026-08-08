import * as locationsRepository from './locations.repository';
import * as circlesRepository from '../circles/circles.repository';
import * as geofencesRepository from '../geofences/geofences.repository';
import * as authRepository from '../auth/auth.repository';
import { redisPubSub } from '../../realtime/redis-pubsub';
import { sendPushToUser } from '../../lib/fcm';

export class LocationError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

// Minimum time between accepted updates from the same user. Chosen as a
// sensible default for a live "where is everyone" map — frequent enough to
// feel live, infrequent enough to bound write volume and battery cost.
// Applied identically to the WS path and the REST fallback so neither can
// be used to bypass the other's throttle.
const MIN_UPDATE_INTERVAL_MS = 4000;

const lastUpdateAtByUser = new Map<string, number>();

export function isRateLimited(userId: string): boolean {
  const last = lastUpdateAtByUser.get(userId);
  if (last === undefined) return false;
  return Date.now() - last < MIN_UPDATE_INTERVAL_MS;
}

// Tracks which geofences each user was inside as of their last processed
// update, per circle — an in-memory diff is enough here (same tradeoff as
// the rate-limit map above): a process restart just means the next update
// is treated as a fresh "entered" event rather than a real loss of data,
// since geofence events are a notification nicety, not a safety-critical
// record like SOS.
const lastGeofenceIdsByUserAndCircle = new Map<string, Set<string>>();

function geofenceStateKey(userId: string, circleId: string): string {
  return `${userId}:${circleId}`;
}

function toPublicLocation(row: locationsRepository.LocationRow) {
  return {
    userId: row.user_id,
    lat: row.lat,
    lng: row.lng,
    speed: row.speed,
    batteryLevel: row.battery_level,
    recordedAt: row.recorded_at.toISOString(),
  };
}

export interface SubmitLocationInput {
  userId: string;
  lat: number;
  lng: number;
  speed?: number | null;
  batteryLevel?: number | null;
  recordedAt?: string;
}

/**
 * Writes the location and publishes it to every circle the user belongs to.
 * Shared by both the WS location:update handler and the REST fallback so
 * rate limiting, validation, and broadcast behavior can't diverge between
 * the two ingest paths.
 */
export async function submitLocation(input: SubmitLocationInput) {
  if (isRateLimited(input.userId)) {
    throw new LocationError('Location updates are limited to one every few seconds', 429);
  }

  const row = await locationsRepository.insertLocation({
    userId: input.userId,
    lat: input.lat,
    lng: input.lng,
    speed: input.speed ?? null,
    batteryLevel: input.batteryLevel ?? null,
    recordedAt: input.recordedAt ? new Date(input.recordedAt) : new Date(),
  });
  lastUpdateAtByUser.set(input.userId, Date.now());

  const location = toPublicLocation(row);

  const circles = await circlesRepository.listCirclesForUser(input.userId);
  await Promise.all(
    circles.map((circle) =>
      redisPubSub.publish(
        `circle:${circle.id}:location`,
        JSON.stringify({
          type: 'location:broadcast',
          payload: { ...location, circleId: circle.id },
        }),
      ),
    ),
  );

  await Promise.all(
    circles.map((circle) =>
      processGeofenceTransitions(input.userId, circle.id, input.lat, input.lng),
    ),
  );

  return location;
}

/**
 * Diffs the geofences containing the new position against the set from the
 * user's last processed update in this circle, and for each entered
 * geofence: publishes a geofence:event to the same circle:{id}:location
 * channel clients already subscribe to (no new WS message type needed),
 * and pushes the *other* circle members (not the user who moved) an FCM
 * notification, per docs/07-data-flow.md Journey 1.
 */
async function processGeofenceTransitions(
  userId: string,
  circleId: string,
  lat: number,
  lng: number,
) {
  const key = geofenceStateKey(userId, circleId);
  const previousIds = lastGeofenceIdsByUserAndCircle.get(key) ?? new Set<string>();

  const containing = await geofencesRepository.findContainingGeofences(circleId, lat, lng);
  const currentIds = new Set(containing.map((g) => g.id));
  lastGeofenceIdsByUserAndCircle.set(key, currentIds);

  const entered = containing.filter((g) => !previousIds.has(g.id));
  if (entered.length === 0) return;

  const user = await authRepository.findUserById(userId);
  const username = user?.username ?? 'A circle member';

  const members = await circlesRepository.listMembers(circleId);
  const otherMemberIds = members.map((m) => m.user_id).filter((id) => id !== userId);

  await Promise.all(
    entered.map(async (geofence) => {
      await redisPubSub.publish(
        `circle:${circleId}:location`,
        JSON.stringify({
          type: 'geofence:event',
          payload: {
            circleId,
            userId,
            geofenceId: geofence.id,
            geofenceName: geofence.name,
            event: 'enter',
            occurredAt: new Date().toISOString(),
          },
        }),
      );

      await Promise.all(
        otherMemberIds.map((memberId) =>
          sendPushToUser(memberId, {
            title: 'Place alert',
            body: `${username} arrived at ${geofence.name}`,
            data: { type: 'geofence', circleId, geofenceId: geofence.id },
          }),
        ),
      );
    }),
  );
}

export async function getLatestLocationsForCircle(userId: string, circleId: string) {
  const membership = await circlesRepository.findMembership(circleId, userId);
  if (!membership) {
    throw new LocationError('Circle not found', 404);
  }
  const rows = await locationsRepository.latestLocationsForCircle(circleId);
  return rows.map(toPublicLocation);
}

export async function updateSharingStatus(userId: string, isSharing: boolean) {
  const user = await authRepository.updateSharingStatus(userId, isSharing);
  return { userId: user.id, isSharing: user.is_sharing };
}
