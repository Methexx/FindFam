import * as locationsRepository from './locations.repository';
import * as circlesRepository from '../circles/circles.repository';
import { redisPubSub } from '../../realtime/redis-pubsub';

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

  return location;
}

export async function getLatestLocationsForCircle(userId: string, circleId: string) {
  const membership = await circlesRepository.findMembership(circleId, userId);
  if (!membership) {
    throw new LocationError('Circle not found', 404);
  }
  const rows = await locationsRepository.latestLocationsForCircle(circleId);
  return rows.map(toPublicLocation);
}
