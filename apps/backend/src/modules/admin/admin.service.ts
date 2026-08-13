import { env } from '../../config/env';
import { verifyPassword } from '../../lib/password';
import { signToken } from '../../lib/jwt';
import * as adminRepository from './admin.repository';
import * as authRepository from '../auth/auth.repository';
import { forceDisconnectUser } from '../../realtime/ws-gateway';
import type { AdminLoginBody, ListUsersQuery } from './admin.schema';

const ADMIN_TOKEN_TTL = '8h';
const ADMIN_WS_TOKEN_TTL = '60s';

export class AdminAuthError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

export class AdminError extends Error {
  constructor(
    message: string,
    public statusCode: number,
  ) {
    super(message);
  }
}

export async function login(body: AdminLoginBody) {
  const admin = await adminRepository.findAdminByEmail(body.email);
  if (!admin) {
    throw new AdminAuthError('Invalid credentials', 401);
  }

  const valid = await verifyPassword(body.password, admin.password_hash);
  if (!valid) {
    throw new AdminAuthError('Invalid credentials', 401);
  }

  const accessToken = await signToken(
    { sub: admin.id, email: admin.email },
    env.ADMIN_JWT_SECRET,
    ADMIN_TOKEN_TTL,
  );

  return {
    admin: { id: admin.id, email: admin.email, createdAt: admin.created_at.toISOString() },
    tokens: { accessToken },
  };
}

// Scoped replacement for handing the full 8h session token to client JS
// just to open a WS connection (the SOS live feed). 60s is enough to open
// one connection and authenticate; aud: 'ws' keeps it from working as a
// general admin credential on any REST route (see plugins/admin-auth.ts).
export async function mintWsToken(adminId: string, email: string) {
  const token = await signToken({ sub: adminId, email, aud: 'ws' }, env.ADMIN_JWT_SECRET, ADMIN_WS_TOKEN_TTL);
  return { token };
}

export async function listCircles() {
  const rows = await adminRepository.listAllCircles();
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    ownerId: row.owner_id,
    memberCount: Number(row.member_count),
    createdAt: row.created_at.toISOString(),
  }));
}

function toPublicSosEvent(row: {
  id: string;
  user_id: string;
  username: string;
  lat: number;
  lng: number;
  status: string;
  triggered_at: Date;
  resolved_at: Date | null;
}) {
  return {
    id: row.id,
    userId: row.user_id,
    username: row.username,
    origin: { lat: row.lat, lng: row.lng },
    status: row.status,
    triggeredAt: row.triggered_at.toISOString(),
    resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
  };
}

export async function listActiveSos() {
  const rows = await adminRepository.listActiveSosEvents();
  return rows.map(toPublicSosEvent);
}

export async function getSosEvent(id: string) {
  const row = await adminRepository.findSosEventById(id);
  if (!row) {
    throw new AdminError('SOS event not found', 404);
  }
  return toPublicSosEvent(row);
}

function toPublicUser(row: {
  id: string;
  username: string;
  email: string;
  suspended_at: Date | null;
  created_at: Date;
}) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    suspended: row.suspended_at !== null,
    suspendedAt: row.suspended_at ? row.suspended_at.toISOString() : null,
    createdAt: row.created_at.toISOString(),
  };
}

function toPublicAuditLogEntry(row: {
  id: string;
  admin_id: string;
  action: string;
  target_user_id: string;
  created_at: Date;
}) {
  return {
    id: row.id,
    adminId: row.admin_id,
    action: row.action,
    targetUserId: row.target_user_id,
    createdAt: row.created_at.toISOString(),
  };
}

function decodeUserCursor(cursor: string): { createdAt: Date; id: string } {
  let decoded: string;
  try {
    decoded = Buffer.from(cursor, 'base64url').toString('utf8');
  } catch {
    throw new AdminError('Invalid cursor', 400);
  }
  const [createdAtIso, id] = decoded.split('|');
  const createdAt = createdAtIso ? new Date(createdAtIso) : null;
  if (!createdAt || Number.isNaN(createdAt.getTime()) || !id) {
    throw new AdminError('Invalid cursor', 400);
  }
  return { createdAt, id };
}

function encodeUserCursor(createdAt: Date, id: string): string {
  return Buffer.from(`${createdAt.toISOString()}|${id}`, 'utf8').toString('base64url');
}

export async function listUsers(query: ListUsersQuery) {
  const before = query.cursor ? decodeUserCursor(query.cursor) : undefined;
  const rows = await adminRepository.listUsers({
    search: query.search,
    limit: query.limit,
    before,
  });

  const users = rows.map(toPublicUser);
  const last = rows[rows.length - 1];
  const nextCursor =
    rows.length === query.limit && last ? encodeUserCursor(last.created_at, last.id) : null;

  return { users, nextCursor };
}

export async function getUserDetail(userId: string) {
  const user = await adminRepository.findUserById(userId);
  if (!user) {
    throw new AdminError('User not found', 404);
  }
  const auditLog = await adminRepository.listAuditLogForUser(userId);
  return { ...toPublicUser(user), auditLog: auditLog.map(toPublicAuditLogEntry) };
}

export async function suspendUser(adminId: string, targetUserId: string) {
  const user = await adminRepository.findUserById(targetUserId);
  if (!user) {
    throw new AdminError('User not found', 404);
  }
  if (user.suspended_at) {
    throw new AdminError('User is already suspended', 409);
  }

  const updated = await adminRepository.setUserSuspended(targetUserId, new Date());
  await authRepository.deleteRefreshTokensForUser(targetUserId);
  forceDisconnectUser(targetUserId);
  await adminRepository.insertAuditLogEntry({
    adminId,
    action: 'suspend_user',
    targetUserId,
  });

  return toPublicUser(updated);
}

export async function unsuspendUser(adminId: string, targetUserId: string) {
  const user = await adminRepository.findUserById(targetUserId);
  if (!user) {
    throw new AdminError('User not found', 404);
  }
  if (!user.suspended_at) {
    throw new AdminError('User is not suspended', 409);
  }

  const updated = await adminRepository.setUserSuspended(targetUserId, null);
  await adminRepository.insertAuditLogEntry({
    adminId,
    action: 'unsuspend_user',
    targetUserId,
  });

  return toPublicUser(updated);
}

const SOS_TREND_WINDOW_DAYS = 14;

export async function getAnalyticsSummary() {
  const [totalUsers, activeCircles, totalSosEvents, sosEventsPerDay] = await Promise.all([
    adminRepository.countUsers(),
    adminRepository.countActiveCircles(),
    adminRepository.countSosEvents(),
    adminRepository.sosEventsPerDay(SOS_TREND_WINDOW_DAYS),
  ]);

  return {
    totalUsers,
    activeCircles,
    totalSosEvents,
    sosEventsPerDay: sosEventsPerDay.map((row) => ({
      day: row.day,
      count: Number(row.count),
    })),
  };
}
