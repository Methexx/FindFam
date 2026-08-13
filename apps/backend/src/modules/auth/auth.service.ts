import { randomBytes, createHash } from 'node:crypto';
import { env } from '../../config/env';
import { hashPassword, verifyPassword } from '../../lib/password';
import { signToken, verifyToken } from '../../lib/jwt';
import * as authRepository from './auth.repository';
import type { RegisterBody, LoginBody, PatchMeBody } from './auth.schema';

const ACCESS_TOKEN_TTL = '15m';
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
  const user = await authRepository.updateUser(userId, {
    avatar_url: body.avatarUrl,
    phone: body.phone,
  });
  return toPublicUser(user);
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

export async function verifyAccessToken(token: string) {
  return verifyToken<{ sub: string; username: string }>(token, env.JWT_SECRET);
}
