import { randomBytes, createHash } from 'node:crypto';
import { env } from '../../config/env';
import { hashPassword, verifyPassword } from '../../lib/password';
import { signToken, verifyToken } from '../../lib/jwt';
import { uploadAvatar } from '../../lib/supabase-storage';
import * as authRepository from './auth.repository';
import type { RegisterBody, LoginBody, PatchMeBody, ChangePasswordBody } from './auth.schema';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Same 60s as ADMIN_WS_TOKEN_TTL. Exists for the browser, which holds its
// access token in an httpOnly cookie and so cannot read it to open a WS
// connection; the BFF exchanges the cookie for one of these server-side.
// Mobile keeps sending its plain access token over `auth` and is unaffected.
const WS_TOKEN_TTL = '60s';

export class AuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

function toPublicUser(row: {
  id: string;
  username: string;
  display_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  is_sharing: boolean;
  created_at: Date;
  updated_at: Date | null;
}) {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone,
    avatarUrl: row.avatar_url,
    isSharing: row.is_sharing,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at ? row.updated_at.toISOString() : null,
  };
}

function hashRefreshToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

async function issueTokenPair(userId: string, username: string) {
  const accessToken = await signToken({ sub: userId, username }, env.JWT_SECRET, ACCESS_TOKEN_TTL);

  const refreshToken = randomBytes(32).toString('hex');
  const tokenHash = hashRefreshToken(refreshToken);
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_MS);
  await authRepository.createRefreshToken(userId, tokenHash, expiresAt);

  return { accessToken, refreshToken };
}

export async function register(body: RegisterBody) {
  const existing = await authRepository.findUserByUsernameOrEmail(body.username);
  if (existing) {
    throw new AuthError('Username already taken', 409);
  }
  const existingEmail = await authRepository.findUserByUsernameOrEmail(body.email);
  if (existingEmail) {
    throw new AuthError('Email already registered', 409);
  }

  const passwordHash = await hashPassword(body.password);
  const user = await authRepository.createUser({
    username: body.username,
    email: body.email,
    phone: body.phone ?? null,
    passwordHash,
  });

  const tokens = await issueTokenPair(user.id, user.username);
  return { user: toPublicUser(user), tokens };
}

export async function login(body: LoginBody) {
  const user = await authRepository.findUserByUsernameOrEmail(body.usernameOrEmail);
  if (!user) {
    throw new AuthError('Invalid credentials', 401);
  }

  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) {
    throw new AuthError('Invalid credentials', 401);
  }

  // Checked after the password check (not before) so a wrong password on a
  // suspended account still reads as "Invalid credentials" rather than
  // leaking suspension status to an unauthenticated caller. 403 rather than
  // 401 so the client can distinguish "wrong password" from "account
  // suspended" — mirrors the identical check in plugins/auth.ts for
  // already-issued tokens.
  if (user.suspended_at) {
    throw new AuthError('Account suspended', 403);
  }

  const tokens = await issueTokenPair(user.id, user.username);
  return { user: toPublicUser(user), tokens };
}

export async function refresh(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);
  const record = await authRepository.findRefreshTokenByHash(tokenHash);

  if (!record || record.expires_at.getTime() < Date.now()) {
    throw new AuthError('Invalid or expired refresh token', 401);
  }

  const user = await authRepository.findUserById(record.user_id);
  if (!user) {
    throw new AuthError('Invalid or expired refresh token', 401);
  }

  // suspendUser already deletes every refresh token for the user, so this
  // mostly closes a race between "suspend" and an in-flight refresh rather
  // than being the primary defense — but it's the only thing that stops a
  // refresh token minted moments before suspension from still working.
  if (user.suspended_at) {
    throw new AuthError('Account suspended', 403);
  }

  const accessToken = await signToken({ sub: user.id, username: user.username }, env.JWT_SECRET, ACCESS_TOKEN_TTL);
  return { accessToken };
}

export async function logout(refreshToken: string) {
  const tokenHash = hashRefreshToken(refreshToken);
  await authRepository.deleteRefreshTokenByHash(tokenHash);
}

export async function getMe(userId: string) {
  const user = await authRepository.findUserById(userId);
  if (!user) {
    throw new AuthError('User not found', 404);
  }
  return toPublicUser(user);
}

export async function updateMe(userId: string, body: PatchMeBody) {
  if (body.username) {
    // Same case-insensitive collision check as registration, backed by the
    // same users_username_lower_idx unique index — a match that isn't this
    // user is a real conflict; a match that IS this user just means they
    // PATCHed their own current username back in, which is a no-op, not
    // an error.
    const existing = await authRepository.findUserByUsername(body.username);
    if (existing && existing.id !== userId) {
      throw new AuthError('Username already taken', 409);
    }
  }

  const user = await authRepository.updateUser(userId, {
    avatar_url: body.avatarUrl,
    phone: body.phone,
    display_name: body.displayName,
    username: body.username,
  });
  return toPublicUser(user);
}

export async function updateAvatar(userId: string, contentType: string, data: Buffer) {
  const publicUrl = await uploadAvatar(userId, contentType, data);
  const user = await authRepository.updateUser(userId, { avatar_url: publicUrl });
  return toPublicUser(user);
}

export async function changePassword(userId: string, body: ChangePasswordBody) {
  const user = await authRepository.findUserById(userId);
  if (!user) {
    throw new AuthError('User not found', 404);
  }

  const valid = await verifyPassword(body.currentPassword, user.password_hash);
  if (!valid) {
    throw new AuthError('Incorrect password', 401);
  }

  const passwordHash = await hashPassword(body.newPassword);
  await authRepository.updateUser(userId, { password_hash: passwordHash });

  // Every *other* session's refresh token must die so a password leaked
  // and then changed can't still be used to mint fresh access tokens — but
  // the caller's own current access token stays valid for the rest of this
  // request/response, since it already had to be to authenticate the call.
  await authRepository.deleteRefreshTokensForUser(userId);
}

export async function deactivateAccount(userId: string) {
  // Reuses the exact suspend mechanism admin.service.ts's suspendUser
  // already exercises — suspended_at already fully blocks login and
  // refresh (see the checks above), so a self-deactivation needs no new
  // blocking logic, and it stays reversible by an admin the same way an
  // admin-issued suspension is today.
  await authRepository.updateUser(userId, { suspended_at: new Date() });
  await authRepository.deleteRefreshTokensForUser(userId);
}

export async function registerFcmToken(userId: string, fcmToken: string) {
  // Must run before writing the new token to userId, or a handoff where B
  // registers the same token A still holds would leave both rows set.
  await authRepository.clearFcmTokenFromOtherUsers(fcmToken, userId);
  await authRepository.setFcmToken(userId, fcmToken);
}

export async function deleteFcmToken(userId: string) {
  await authRepository.setFcmToken(userId, null);
}

/**
 * Mints a short-lived, ws-scoped token for the web client. `aud: 'ws'` is
 * informational on the user path — unlike the admin gateway branch, the
 * user branch does NOT assert it, because mobile authenticates with a plain
 * access token and asserting `aud` there would disconnect every phone.
 */
export async function mintWsToken(userId: string, username: string) {
  const token = await signToken({ sub: userId, username, aud: 'ws' }, env.JWT_SECRET, WS_TOKEN_TTL);
  return { token };
}

export async function verifyAccessToken(token: string) {
  return verifyToken<{ sub: string; username: string }>(token, env.JWT_SECRET);
}
