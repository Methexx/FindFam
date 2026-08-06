import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../../../src/app';
import { db } from '../../../src/config/db';
import { hashPassword } from '../../../src/lib/password';
import { truncateAll } from '../../setup';

const app = buildApp();

async function seedAdmin(email: string, password: string) {
  const passwordHash = await hashPassword(password);
  return db
    .insertInto('admins')
    .values({ email, password_hash: passwordHash })
    .returningAll()
    .executeTakeFirstOrThrow();
}

describe('admin routes (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('logs in a seeded admin independent of the users table', async () => {
    await seedAdmin('admin@example.com', 'adminpass123');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: { email: 'admin@example.com', password: 'adminpass123' },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.data.admin.email).toBe('admin@example.com');
    expect(body.data.tokens.accessToken).toBeTruthy();
  });

  it('rejects an unknown admin email', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/login',
      payload: { email: 'ghost@example.com', password: 'whatever' },
    });
    expect(res.statusCode).toBe(401);
  });

  describe('auth isolation', () => {
    it('rejects an admin access token on a user-protected route', async () => {
      await seedAdmin('isolation-admin@example.com', 'adminpass123');
      const loginRes = await app.inject({
        method: 'POST',
        url: '/api/v1/admin/auth/login',
        payload: { email: 'isolation-admin@example.com', password: 'adminpass123' },
      });
      const { accessToken } = loginRes.json().data.tokens;

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
