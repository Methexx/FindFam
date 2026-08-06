import { db } from '../../config/db';

export async function createCircleWithOwner(name: string, ownerId: string) {
  return db.transaction().execute(async (trx) => {
    const circle = await trx
      .insertInto('circles')
      .values({ name, owner_id: ownerId })
      .returningAll()
      .executeTakeFirstOrThrow();

    await trx
      .insertInto('circle_members')
      .values({ circle_id: circle.id, user_id: ownerId, role: 'owner' })
      .execute();

    return circle;
  });
}

export function findCircleById(id: string) {
  return db
    .selectFrom('circles')
    .selectAll()
    .where('id', '=', id)
    .where('deleted_at', 'is', null)
    .executeTakeFirst();
}

export function listCirclesForUser(userId: string) {
  return db
    .selectFrom('circles')
    .innerJoin('circle_members', 'circle_members.circle_id', 'circles.id')
    .selectAll('circles')
    .where('circle_members.user_id', '=', userId)
    .where('circles.deleted_at', 'is', null)
    .execute();
}

export function updateCircleName(id: string, name: string) {
  return db
    .updateTable('circles')
    .set({ name })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function softDeleteCircle(id: string) {
  return db
    .updateTable('circles')
    .set({ deleted_at: new Date() })
    .where('id', '=', id)
    .execute();
}

export function findMembership(circleId: string, userId: string) {
  return db
    .selectFrom('circle_members')
    .selectAll()
    .where('circle_id', '=', circleId)
    .where('user_id', '=', userId)
    .executeTakeFirst();
}

export function listMembers(circleId: string) {
  return db
    .selectFrom('circle_members')
    .innerJoin('users', 'users.id', 'circle_members.user_id')
    .select([
      'circle_members.circle_id',
      'circle_members.user_id',
      'circle_members.role',
      'circle_members.joined_at',
      'users.username',
    ])
    .where('circle_members.circle_id', '=', circleId)
    .execute();
}

export function addMember(circleId: string, userId: string) {
  return db
    .insertInto('circle_members')
    .values({ circle_id: circleId, user_id: userId, role: 'member' })
    .execute();
}

export function removeMember(circleId: string, userId: string) {
  return db
    .deleteFrom('circle_members')
    .where('circle_id', '=', circleId)
    .where('user_id', '=', userId)
    .execute();
}
