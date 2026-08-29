import { randomInt } from 'node:crypto';
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

// Must match migration 016's alphabet: no I, L, O, 0 or 1, because an invite
// code is read aloud and typed by hand and ambiguous glyphs are a real
// defect. Uniqueness is enforced by circles_invite_code_key, not here —
// generate, try to insert, retry a bounded number of times on 23505.
const INVITE_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const INVITE_CODE_LENGTH = 8;
const INVITE_CODE_MAX_ATTEMPTS = 5;

function generateInviteCode(): string {
  let code = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    code += INVITE_CODE_ALPHABET[randomInt(INVITE_CODE_ALPHABET.length)];
  }
  return code;
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' && err !== null && (err as { code?: string }).code === '23505'
  );
}

/** Codes are stored uppercase; a pasted or hand-typed one is normalised here. */
function normalizeInviteCode(code: string): string {
  return code.trim().toUpperCase();
}

// `viewerId` decides whether the invite code comes back at all. Only the
// owner sees it, matching addMember/updateCircle/deleteCircle being
// owner-only — "who can bring someone into this circle" stays one rule
// rather than two that can drift apart.
function toPublicCircle(
  row: {
    id: string;
    name: string;
    owner_id: string;
    invite_code: string;
    created_at: Date;
    deleted_at: Date | null;
  },
  viewerId: string,
) {
  return {
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    inviteCode: row.owner_id === viewerId ? row.invite_code : null,
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
  // The unique index is what actually guarantees no two circles share a
  // code, so the loop just re-rolls on a collision rather than pre-checking
  // for one (which would race). createCircleWithOwner runs in a
  // transaction, so a failed attempt leaves nothing behind to clean up.
  for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const circle = await circlesRepository.createCircleWithOwner(
        name,
        userId,
        generateInviteCode(),
      );
      return toPublicCircle(circle, userId);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new CircleError('Could not allocate an invite code — please try again', 503);
}

export async function listCircles(userId: string) {
  const rows = await circlesRepository.listCirclesForUser(userId);
  return rows.map((row) => toPublicCircle(row, userId));
}

export async function getCircle(userId: string, circleId: string) {
  const { circle } = await requireMembership(userId, circleId);
  const members = await circlesRepository.listMembers(circleId);
  return { ...toPublicCircle(circle, userId), members: members.map(toPublicMember) };
}

export async function updateCircle(userId: string, circleId: string, name: string) {
  const { membership } = await requireMembership(userId, circleId);
  if (membership.role !== 'owner') {
    throw new CircleError('Only the owner can update this circle', 403);
  }
  const updated = await circlesRepository.updateCircleName(circleId, name);
  return toPublicCircle(updated, userId);
}

/**
 * The second way into a circle, beside the owner adding a mutually-followed
 * user with addMember below.
 *
 * This deliberately does NOT require a follow relationship, and that is not
 * a hole in the consent model — it is the same model reached by a different
 * pair of acts. addMember requires a mutual follow because being *added* by
 * somebody else is not consent from the person being added. Here the two
 * acts are explicit and swapped: the owner consented by issuing the code
 * (and can revoke it with rotateInviteCode), and the joiner consented by
 * entering it. Do not "fix" this by adding a follow check — that would make
 * a circle unjoinable by exactly the people an invite code exists for.
 */
export async function joinCircleByCode(userId: string, code: string) {
  const circle = await circlesRepository.findCircleByInviteCode(normalizeInviteCode(code));
  if (!circle) {
    throw new CircleError('Invalid invite code', 404);
  }

  const existingMembership = await circlesRepository.findMembership(circle.id, userId);
  if (existingMembership) {
    throw new CircleError('You are already in this circle', 409);
  }

  await circlesRepository.addMember(circle.id, userId);
  return toPublicCircle(circle, userId);
}

export async function rotateInviteCode(userId: string, circleId: string) {
  const { membership } = await requireMembership(userId, circleId);
  if (membership.role !== 'owner') {
    throw new CircleError('Only the owner can rotate the invite code', 403);
  }

  for (let attempt = 0; attempt < INVITE_CODE_MAX_ATTEMPTS; attempt += 1) {
    try {
      const updated = await circlesRepository.updateInviteCode(circleId, generateInviteCode());
      return toPublicCircle(updated, userId);
    } catch (err) {
      if (!isUniqueViolation(err)) throw err;
    }
  }
  throw new CircleError('Could not allocate an invite code — please try again', 503);
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
