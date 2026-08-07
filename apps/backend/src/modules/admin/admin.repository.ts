import { sql } from 'kysely';
import { db } from '../../config/db';

export function findAdminByEmail(email: string) {
  return db.selectFrom('admins').selectAll().where('email', '=', email).executeTakeFirst();
}

const sosSelectColumns = [
  'sos_events.id',
  'sos_events.user_id',
  'users.username',
  sql<number>`ST_Y(sos_events.origin::geometry)`.as('lat'),
  sql<number>`ST_X(sos_events.origin::geometry)`.as('lng'),
  'sos_events.status',
  'sos_events.triggered_at',
  'sos_events.resolved_at',
] as const;

export function listActiveSosEvents() {
  return db
    .selectFrom('sos_events')
    .innerJoin('users', 'users.id', 'sos_events.user_id')
    .select(sosSelectColumns)
    .where('sos_events.status', '=', 'active')
    .orderBy('sos_events.triggered_at', 'desc')
    .execute();
}

export function findSosEventById(id: string) {
  return db
    .selectFrom('sos_events')
    .innerJoin('users', 'users.id', 'sos_events.user_id')
    .select(sosSelectColumns)
    .where('sos_events.id', '=', id)
    .executeTakeFirst();
}

export function listAllCircles() {
  return db
    .selectFrom('circles')
    .leftJoin('circle_members', 'circle_members.circle_id', 'circles.id')
    .select([
      'circles.id',
      'circles.name',
      'circles.owner_id',
      'circles.created_at',
      sql<number>`count(circle_members.user_id)`.as('member_count'),
    ])
    .where('circles.deleted_at', 'is', null)
    .groupBy(['circles.id', 'circles.name', 'circles.owner_id', 'circles.created_at'])
    .execute();
}
