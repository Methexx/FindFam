import { sql } from 'kysely';
import { db } from '../../config/db';

export interface InsertLocationInput {
  userId: string;
  lat: number;
  lng: number;
  speed: number | null;
  batteryLevel: number | null;
  recordedAt: Date;
  platform: 'web' | 'mobile' | null;
}

export interface LocationRow {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  speed: number | null;
  battery_level: number | null;
  recorded_at: Date;
  platform: string | null;
  username?: string;
}

export async function insertLocation(input: InsertLocationInput): Promise<LocationRow> {
  const row = await db
    .insertInto('locations')
    .values({
      user_id: input.userId,
      geom: sql`ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography`,
      speed: input.speed,
      battery_level: input.batteryLevel,
      recorded_at: input.recordedAt,
      platform: input.platform,
    })
    .returning([
      'id',
      'user_id',
      sql<number>`ST_Y(geom::geometry)`.as('lat'),
      sql<number>`ST_X(geom::geometry)`.as('lng'),
      'speed',
      'battery_level',
      'recorded_at',
      'platform',
    ])
    .executeTakeFirstOrThrow();

  return row as LocationRow;
}

/**
 * Latest known location for every member of a circle — one row per member,
 * via DISTINCT ON ordered by recorded_at DESC (falls back to no row for
 * members who have never reported a location).
 */
export function latestLocationsForCircle(circleId: string): Promise<LocationRow[]> {
  return db
    .selectFrom('locations')
    .innerJoin('circle_members', 'circle_members.user_id', 'locations.user_id')
    .innerJoin('users', 'users.id', 'locations.user_id')
    .distinctOn('locations.user_id')
    .select([
      'locations.id',
      'locations.user_id',
      sql<number>`ST_Y(locations.geom::geometry)`.as('lat'),
      sql<number>`ST_X(locations.geom::geometry)`.as('lng'),
      'locations.speed',
      'locations.battery_level',
      'locations.recorded_at',
      'locations.platform',
      'users.username',
    ])
    .where('circle_members.circle_id', '=', circleId)
    .orderBy('locations.user_id')
    .orderBy('locations.recorded_at', 'desc')
    .execute() as Promise<LocationRow[]>;
}

/**
 * The caller's own most recent location, independent of circle membership —
 * distinct from latestLocationsForCircle's "who in this circle has reported
 * one", this is "did I ever report one at all".
 */
export function latestLocationForUser(userId: string): Promise<LocationRow | undefined> {
  return db
    .selectFrom('locations')
    .innerJoin('users', 'users.id', 'locations.user_id')
    .select([
      'locations.id',
      'locations.user_id',
      sql<number>`ST_Y(locations.geom::geometry)`.as('lat'),
      sql<number>`ST_X(locations.geom::geometry)`.as('lng'),
      'locations.speed',
      'locations.battery_level',
      'locations.recorded_at',
      'locations.platform',
      'users.username',
    ])
    .where('locations.user_id', '=', userId)
    .orderBy('locations.recorded_at', 'desc')
    .limit(1)
    .executeTakeFirst() as Promise<LocationRow | undefined>;
}
