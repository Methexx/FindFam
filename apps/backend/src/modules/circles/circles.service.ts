import * as circlesRepository from './circles.repository';
import * as authRepository from '../auth/auth.repository';
import * as followsRepository from '../follows/follows.repository';

export class CircleError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

function toPublicCircle(row: {
  id: string;
  name: string;
  owner_id: string;
  created_at: Date;
  deleted_at: Date | null;
}) {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    createdAt: row.created_at.toISOString(),
    deletedAt: row.deleted_at ? row.deleted_at.toISOString() : null,
  };
}

function toPublicMember(row: {
  circle_id: string;
  user_id: string;
  role: string;
  joined_at: Date;
  username: string;
}) {
  return {
    circleId: row.circle_id,
    userId: row.user_id,
    role: row.role,
    joinedAt: row.joined_at.toISOString(),
    username: row.username,
  };
}

async function requireMembership(userId: string, circleId: string) {
  const circle = await circlesRepository.findCircleById(circleId);
  if (!circle) {
    throw new CircleError('Circle not found', 404);
  }
  const membership = await circlesRepository.findMembership(circleId, userId);
  if (!membership) {
    // A non-member gets the same "not found" response as a nonexistent
    // circle — existence of a private circle is not disclosed to outsiders.
    throw new CircleError('Circle not found', 404);
  }
  return { circle, membership };
}

export async function createCircle(userId: string, name: string) {
  const circle = await circlesRepository.createCircleWithOwner(name, userId);
  return toPublicCircle(circle);
}

export async function listCircles(userId: string) {
  const rows = await circlesRepository.listCirclesForUser(userId);
  return rows.map(toPublicCircle);
}

export async function getCircle(userId: string, circleId: string) {
  const { circle } = await requireMembership(userId, circleId);
  const members = await circlesRepository.listMembers(circleId);
  return { ...toPublicCircle(circle), members: members.map(toPublicMember) };
}

export async function updateCircle(userId: string, circleId: string, name: string) {
  const { membership } = await requireMembership(userId, circleId);
  if (membership.role !== 'owner') {
    throw new CircleError('Only the owner can update this circle', 403);
  }
  const updated = await circlesRepository.updateCircleName(circleId, name);
  return toPublicCircle(updated);
}

export async function deleteCircle(userId: string, circleId: string) {
  const { membership } = await requireMembership(userId, circleId);
  if (membership.role !== 'owner') {
    throw new CircleError('Only the owner can delete this circle', 403);
  }
  await circlesRepository.softDeleteCircle(circleId);
}

export async function addMember(userId: string, circleId: string, targetUsername: string) {
  const { membership } = await requireMembership(userId, circleId);
  if (membership.role !== 'owner') {
    throw new CircleError('Only the owner can add members', 403);
  }

  const target = await authRepository.findUserByUsername(targetUsername);
  if (!target) {
    throw new CircleError('User not found', 404);
  }

  const existingMembership = await circlesRepository.findMembership(circleId, target.id);
  if (existingMembership) {
    throw new CircleError('User is already a member', 409);
  }

  const accepted = await followsRepository.findAcceptedFollowBetween(userId, target.id);
  if (!accepted) {
    throw new CircleError(
      'The owner and this user must be mutually followed before they can be added to a circle',
      403,
    );
  }

  await circlesRepository.addMember(circleId, target.id);
}

export async function removeMember(userId: string, circleId: string, targetUserId: string) {
  const { membership } = await requireMembership(userId, circleId);

  const isSelf = targetUserId === userId;
  if (!isSelf && membership.role !== 'owner') {
    throw new CircleError('Only the owner can remove other members', 403);
  }
  if (isSelf && membership.role === 'owner') {
    throw new CircleError('The owner cannot leave — delete the circle instead', 400);
  }

  await circlesRepository.removeMember(circleId, targetUserId);
}
