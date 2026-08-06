import { sql } from 'kysely';
import { db } from '../../config/db';

export function findAdminByEmail(email: string) {
  return db.selectFrom('admins').selectAll().where('email', '=', email).executeTakeFirst();
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
