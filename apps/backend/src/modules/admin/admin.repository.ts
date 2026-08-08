import { sql } from 'kysely';
import { db } from '../../config/db';

export function findAdminByEmail(email: string) {
  return db.selectFrom('admins').selectAll().where('email', '=', email).executeTakeFirst();
}

/**
 * Keyset pagination on (created_at DESC, id DESC), same pattern as
 * messages.repository.listMessagesForCircle — offset pagination degrades
 * under concurrent inserts.
 */
export function listUsers(opts: {
  search?: string;
  limit: number;
  before?: { createdAt: Date; id: string };
}) {
  let query = db.selectFrom('users').selectAll();

  if (opts.search) {
    const pattern = `%${opts.search}%`;
    query = query.where((eb) =>
      eb.or([eb('username', 'ilike', pattern), eb('email', 'ilike', pattern)]),
    );
  }

  if (opts.before) {
    const { createdAt, id } = opts.before;
    query = query.where(({ eb, or, and }) =>
      or([
        eb('created_at', '<', createdAt),
        and([eb('created_at', '=', createdAt), eb('id', '<', id)]),
      ]),
    );
  }

  return query.orderBy('created_at', 'desc').orderBy('id', 'desc').limit(opts.limit).execute();
}

export function findUserById(id: string) {
  return db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();
}

export function setUserSuspended(id: string, suspendedAt: Date | null) {
  return db
    .updateTable('users')
    .set({ suspended_at: suspendedAt })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function insertAuditLogEntry(input: {
  adminId: string;
  action: string;
  targetUserId: string;
}) {
  return db
    .insertInto('admin_audit_log')
    .values({ admin_id: input.adminId, action: input.action, target_user_id: input.targetUserId })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function listAuditLogForUser(targetUserId: string) {
  return db
    .selectFrom('admin_audit_log')
    .selectAll()
    .where('target_user_id', '=', targetUserId)
    .orderBy('created_at', 'desc')
    .execute();
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

export async function countUsers(): Promise<number> {
  const row = await db
    .selectFrom('users')
    .select(sql<number>`count(*)`.as('count'))
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

export async function countActiveCircles(): Promise<number> {
  const row = await db
    .selectFrom('circles')
    .select(sql<number>`count(*)`.as('count'))
    .where('deleted_at', 'is', null)
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

export async function countSosEvents(): Promise<number> {
  const row = await db
    .selectFrom('sos_events')
    .select(sql<number>`count(*)`.as('count'))
    .executeTakeFirstOrThrow();
  return Number(row.count);
}

export interface SosEventsPerDayRow {
  day: string;
  count: number;
}

export function sosEventsPerDay(sinceDays: number): Promise<SosEventsPerDayRow[]> {
  return db
    .selectFrom('sos_events')
    .select([
      sql<string>`date_trunc('day', triggered_at)`.as('day'),
      sql<number>`count(*)`.as('count'),
    ])
    .where('triggered_at', '>=', new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000))
    .groupBy(sql`date_trunc('day', triggered_at)`)
    .orderBy(sql`date_trunc('day', triggered_at)`, 'asc')
    .execute() as Promise<SosEventsPerDayRow[]>;
}
