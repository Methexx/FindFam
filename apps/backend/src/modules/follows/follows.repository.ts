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
    .innerJoin('users as follower', 'follower.id', 'follows.follower_id')
    .innerJoin('users as followee', 'followee.id', 'follows.followee_id')
    .select([
      'follows.id',
      'follows.follower_id',
      'follows.followee_id',
      'follows.status',
      'follows.created_at',
      'follower.username as follower_username',
      'followee.username as followee_username',
    ])
    .where('follows.followee_id', '=', userId)
    .where('follows.status', '=', 'pending')
    .execute();
}

// Both sides are joined, not just the follower. This list is bidirectional —
// it returns rows where the caller is the followee AND rows where they are
// the follower — so joining only `follower_username` left the caller's own
// name on half the rows and no name at all for the person on the other end,
// which is exactly the name a client needs to render.
export function listAcceptedForUser(userId: string) {
  return db
    .selectFrom('follows')
    .innerJoin('users as follower', 'follower.id', 'follows.follower_id')
    .innerJoin('users as followee', 'followee.id', 'follows.followee_id')
    .select([
      'follows.id',
      'follows.follower_id',
      'follows.followee_id',
      'follows.status',
      'follows.created_at',
      'follower.username as follower_username',
      'followee.username as followee_username',
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
