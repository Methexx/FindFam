import { env } from '../../config/env';
import { verifyPassword } from '../../lib/password';
import { signToken } from '../../lib/jwt';
import * as adminRepository from './admin.repository';
import type { AdminLoginBody } from './admin.schema';

const ADMIN_TOKEN_TTL = '8h';

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
