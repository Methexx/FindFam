import { db } from '../../config/db';

export function findFollowById(id: string) {
  return db.selectFrom('follows').selectAll().where('id', '=', id).executeTakeFirst();
}

export function findFollowBetween(followerId: string, followeeId: string) {
  return db
    .selectFrom('follows')
    .selectAll()
    .where('follower_id', '=', followerId)
    .where('followee_id', '=', followeeId)
    .executeTakeFirst();
}

export function createFollow(followerId: string, followeeId: string) {
  return db
    .insertInto('follows')
    .values({ follower_id: followerId, followee_id: followeeId, status: 'pending' })
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function updateFollowStatus(id: string, status: 'accepted' | 'blocked') {
  return db
    .updateTable('follows')
    .set({ status })
    .where('id', '=', id)
    .returningAll()
    .executeTakeFirstOrThrow();
}

export function deleteFollow(id: string) {
  return db.deleteFrom('follows').where('id', '=', id).execute();
}

export function listPendingForUser(userId: string) {
  return db
    .selectFrom('follows')
    .innerJoin('users', 'users.id', 'follows.follower_id')
    .select([
      'follows.id',
      'follows.follower_id',
      'follows.followee_id',
      'follows.status',
      'follows.created_at',
      'users.username as follower_username',
    ])
    .where('follows.followee_id', '=', userId)
    .where('follows.status', '=', 'pending')
    .execute();
}

export function listAcceptedForUser(userId: string) {
  return db
    .selectFrom('follows')
    .innerJoin('users', 'users.id', 'follows.follower_id')
    .select([
      'follows.id',
      'follows.follower_id',
      'follows.followee_id',
      'follows.status',
      'follows.created_at',
      'users.username as follower_username',
    ])
    .where('follows.status', '=', 'accepted')
    .where((eb) =>
      eb.or([eb('follows.follower_id', '=', userId), eb('follows.followee_id', '=', userId)]),
    )
    .execute();
}

export function findAcceptedFollowBetween(userAId: string, userBId: string) {
  return db
    .selectFrom('follows')
    .selectAll()
    .where('status', '=', 'accepted')
    .where((eb) =>
      eb.or([
        eb.and([eb('follower_id', '=', userAId), eb('followee_id', '=', userBId)]),
        eb.and([eb('follower_id', '=', userBId), eb('followee_id', '=', userAId)]),
      ]),
    )
    .executeTakeFirst();
}
