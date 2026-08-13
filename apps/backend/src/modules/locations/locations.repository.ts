import { sql } from 'kysely';
import { db } from '../../config/db';

export interface InsertLocationInput {
  userId: string;
  lat: number;
  lng: number;
  speed: number | null;
  batteryLevel: number | null;
  recordedAt: Date;
}

export interface LocationRow {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  speed: number | null;
  battery_level: number | null;
  recorded_at: Date;
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
    })
    .returning([
      'id',
      'user_id',
      sql<number>`ST_Y(geom::geometry)`.as('lat'),
      sql<number>`ST_X(geom::geometry)`.as('lng'),
      'speed',
      'battery_level',
      'recorded_at',
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
      'users.username',
    ])
    .where('circle_members.circle_id', '=', circleId)
    .orderBy('locations.user_id')
    .orderBy('locations.recorded_at', 'desc')
    .execute() as Promise<LocationRow[]>;
}
