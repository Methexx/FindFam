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

async function loginAdmin(email: string, password: string): Promise<string> {
  await seedAdmin(email, password);
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/auth/login',
    payload: { email, password },
  });
  return res.json().data.tokens.accessToken;
}

async function registerUser(username: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      username,
      email: `${username}@example.com`,
      password: 'password123',
    },
  });
  const body = res.json();
  return { userId: body.data.user.id, accessToken: body.data.tokens.accessToken };
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

  describe('user moderation', () => {
    it('suspends a user, taking effect on their very next request, and unsuspend restores access', async () => {
      const adminToken = await loginAdmin('mod-admin1@example.com', 'adminpass123');
      const alice = await registerUser('mod_alice1');

      const preSuspendRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${alice.accessToken}` },
      });
      expect(preSuspendRes.statusCode).toBe(200);

      const suspendRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${alice.userId}/suspend`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(suspendRes.statusCode).toBe(200);
      expect(suspendRes.json().data.suspended).toBe(true);

      const suspendedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${alice.accessToken}` },
      });
      expect(suspendedRes.statusCode).toBe(403);

      const unsuspendRes = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${alice.userId}/unsuspend`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(unsuspendRes.statusCode).toBe(200);
      expect(unsuspendRes.json().data.suspended).toBe(false);

      // The old access token is now unrevoked-but-usable again (suspension
      // was the only thing blocking it), same JWT as before.
      const restoredRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${alice.accessToken}` },
      });
      expect(restoredRes.statusCode).toBe(200);
    });

    it('rejects double-suspend and double-unsuspend as idempotency conflicts', async () => {
      const adminToken = await loginAdmin('mod-admin2@example.com', 'adminpass123');
      const alice = await registerUser('mod_alice2');

      const firstSuspend = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${alice.userId}/suspend`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(firstSuspend.statusCode).toBe(200);

      const secondSuspend = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${alice.userId}/suspend`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(secondSuspend.statusCode).toBe(409);

      const bob = await registerUser('mod_bob2');
      const unsuspendNeverSuspended = await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${bob.userId}/unsuspend`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(unsuspendNeverSuspended.statusCode).toBe(409);
    });

    it('creates an audit log entry visible via the user-detail endpoint', async () => {
      const adminToken = await loginAdmin('mod-admin3@example.com', 'adminpass123');
      const alice = await registerUser('mod_alice3');

      await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${alice.userId}/suspend`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/admin/users/${alice.userId}/unsuspend`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/v1/admin/users/${alice.userId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(detailRes.statusCode).toBe(200);
      const actions = detailRes.json().data.auditLog.map((e: { action: string }) => e.action);
      expect(actions).toEqual(['unsuspend_user', 'suspend_user']);
    });

    it('searches and paginates users', async () => {
      const adminToken = await loginAdmin('mod-admin4@example.com', 'adminpass123');
      await registerUser('searchable_alice');
      await registerUser('searchable_bob');
      await registerUser('unrelated_carol');

      const searchRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users?search=searchable',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(searchRes.statusCode).toBe(200);
      const usernames = searchRes.json().data.users.map((u: { username: string }) => u.username);
      expect(usernames.sort()).toEqual(['searchable_alice', 'searchable_bob']);

      const pagedRes = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/users?limit=1',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(pagedRes.json().data.users).toHaveLength(1);
      expect(pagedRes.json().data.nextCursor).toBeTruthy();
    });
  });
});
