import { sql } from 'kysely';
import { db } from '../../config/db';

export interface SosEventRow {
  id: string;
  user_id: string;
  lat: number;
  lng: number;
  status: 'active' | 'resolved' | 'cancelled';
  triggered_at: Date;
  resolved_at: Date | null;
}

const selectColumns = [
  'id',
  'user_id',
  sql<number>`ST_Y(origin::geometry)`.as('lat'),
  sql<number>`ST_X(origin::geometry)`.as('lng'),
  'status',
  'triggered_at',
  'resolved_at',
] as const;

export async function insertSosEvent(input: {
  userId: string;
  lat: number;
  lng: number;
  triggeredAt: Date;
}): Promise<SosEventRow> {
  const row = await db
    .insertInto('sos_events')
    .values({
      user_id: input.userId,
      origin: sql`ST_SetSRID(ST_MakePoint(${input.lng}, ${input.lat}), 4326)::geography`,
      status: 'active',
      triggered_at: input.triggeredAt,
    })
    .returning(selectColumns)
    .executeTakeFirstOrThrow();

  return row as SosEventRow;
}

export async function findRecentActiveEvent(
  userId: string,
  sinceMs: number,
): Promise<SosEventRow | undefined> {
  const row = await db
    .selectFrom('sos_events')
    .select(selectColumns)
    .where('user_id', '=', userId)
    .where('status', '=', 'active')
    .where('triggered_at', '>=', new Date(Date.now() - sinceMs))
    .orderBy('triggered_at', 'desc')
    .executeTakeFirst();

  return row as SosEventRow | undefined;
}

export async function findEventById(id: string): Promise<SosEventRow | undefined> {
  const row = await db
    .selectFrom('sos_events')
    .select(selectColumns)
    .where('id', '=', id)
    .executeTakeFirst();

  return row as SosEventRow | undefined;
}

export async function resolveEvent(
  id: string,
  status: 'resolved' | 'cancelled',
  resolvedAt: Date,
): Promise<SosEventRow> {
  const row = await db
    .updateTable('sos_events')
    .set({ status, resolved_at: resolvedAt })
    .where('id', '=', id)
    .returning(selectColumns)
    .executeTakeFirstOrThrow();

  return row as SosEventRow;
}

export async function listActiveEventsForUsers(userIds: string[]): Promise<SosEventRow[]> {
  if (userIds.length === 0) return [];
  const rows = await db
    .selectFrom('sos_events')
    .select(selectColumns)
    .where('status', '=', 'active')
    .where('user_id', 'in', userIds)
    .orderBy('triggered_at', 'desc')
    .execute();

  return rows as SosEventRow[];
}
