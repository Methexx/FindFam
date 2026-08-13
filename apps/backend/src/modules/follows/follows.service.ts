import * as followsRepository from './follows.repository';
import * as authRepository from '../auth/auth.repository';

export class FollowError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

function toPublicFollow(row: {
  id: string;
  follower_id: string;
  followee_id: string;
  status: string;
  created_at: Date;
  follower_username?: string;
}) {
  return {
    id: row.id,
    followerId: row.follower_id,
    followerUsername: row.follower_username ?? null,
    followeeId: row.followee_id,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

export async function sendFollowRequest(followerId: string, followeeUsername: string) {
  const followee = await authRepository.findUserByUsername(followeeUsername);
  if (!followee) {
    throw new FollowError('User not found', 404);
  }
  if (followee.id === followerId) {
    throw new FollowError('Cannot follow yourself', 400);
  }

  const existing = await followsRepository.findFollowBetween(followerId, followee.id);
  if (existing) {
    throw new FollowError('Follow request already exists', 409);
  }

  const follow = await followsRepository.createFollow(followerId, followee.id);
  return toPublicFollow(follow);
}

export async function respondToFollow(
  actingUserId: string,
  followId: string,
  action: 'accept' | 'reject',
) {
  const follow = await followsRepository.findFollowById(followId);
  if (!follow) {
    throw new FollowError('Follow request not found', 404);
  }
  if (follow.followee_id !== actingUserId) {
    throw new FollowError('Only the followee can respond to this request', 403);
  }
  if (follow.status !== 'pending') {
    throw new FollowError('Follow request is not pending', 409);
  }

  if (action === 'reject') {
    await followsRepository.deleteFollow(followId);
    return null;
  }

  const updated = await followsRepository.updateFollowStatus(followId, 'accepted');
  return toPublicFollow(updated);
}

export async function removeFollow(actingUserId: string, followId: string) {
  const follow = await followsRepository.findFollowById(followId);
  if (!follow) {
    throw new FollowError('Follow not found', 404);
  }
  if (follow.follower_id !== actingUserId && follow.followee_id !== actingUserId) {
    throw new FollowError('Not part of this follow relationship', 403);
  }

  await followsRepository.deleteFollow(followId);
}

export async function getPending(userId: string) {
  const rows = await followsRepository.listPendingForUser(userId);
  return rows.map(toPublicFollow);
}

export async function getAccepted(userId: string) {
  const rows = await followsRepository.listAcceptedForUser(userId);
  return rows.map(toPublicFollow);
}
