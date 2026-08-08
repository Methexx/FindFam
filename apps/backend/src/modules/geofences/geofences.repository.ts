import { sql } from 'kysely';
import { db } from '../../config/db';

export interface GeofenceRow {
  id: string;
  circle_id: string;
  name: string;
  lat: number;
  lng: number;
  radius_meters: number;
  created_by: string;
}

const selectColumns = [
  'id',
  'circle_id',
  'name',
  sql<number>`ST_Y(center::geometry)`.as('lat'),
  sql<number>`ST_X(center::geometry)`.as('lng'),
  'radius_meters',
  'created_by',
] as const;

export async function insertGeofence(input: {
  circleId: string;
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  createdBy: string;
}): Promise<GeofenceRow> {
  const row = await db
    .insertInto('geofences')
    .values({
      circle_id: input.circleId,
      name: input.name,
      center: sql`ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography`,
      radius_meters: input.radiusMeters,
      created_by: input.createdBy,
    })
    .returning(selectColumns)
    .executeTakeFirstOrThrow();

  return row as GeofenceRow;
}

export async function listGeofencesForCircle(circleId: string): Promise<GeofenceRow[]> {
  const rows = await db
    .selectFrom('geofences')
    .select(selectColumns)
    .where('circle_id', '=', circleId)
    .execute();

  return rows as GeofenceRow[];
}

export async function findGeofenceById(id: string): Promise<GeofenceRow | undefined> {
  const row = await db
    .selectFrom('geofences')
    .select(selectColumns)
    .where('id', '=', id)
    .executeTakeFirst();

  return row as GeofenceRow | undefined;
}

export function deleteGeofence(id: string) {
  return db.deleteFrom('geofences').where('id', '=', id).execute();
}

/**
 * Geofences containing a point, via ST_DWithin (a Postgres/PostGIS
 * geography distance check, not literal circle-containment math). Used by
 * the location-update path to detect enter/exit transitions.
 */
export async function findContainingGeofences(
  circleId: string,
  lat: number,
  lng: number,
): Promise<GeofenceRow[]> {
  const rows = await db
    .selectFrom('geofences')
    .select(selectColumns)
    .where('circle_id', '=', circleId)
    .where(
      sql<boolean>`ST_DWithin(center, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography, radius_meters)`,
    )
    .execute();

  return rows as GeofenceRow[];
}
