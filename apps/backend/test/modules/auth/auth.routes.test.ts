import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../../../src/app';
import { db } from '../../../src/config/db';
import { truncateAll } from '../../setup';

const app = buildApp();

async function registerUser(username: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/auth/register',
    payload: {
      username,
      email: `${username}@example.com`,
      password: 'password123',
    },
  });
}

describe('auth routes (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('runs the full register -> login -> refresh -> logout flow', async () => {
    const registerRes = await registerUser('flowuser');
    expect(registerRes.statusCode).toBe(201);
    const registerBody = registerRes.json();
    expect(registerBody.data.tokens.accessToken).toBeTruthy();

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { usernameOrEmail: 'flowuser', password: 'password123' },
    });
    expect(loginRes.statusCode).toBe(200);
    const { accessToken, refreshToken } = loginRes.json().data.tokens;

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(meRes.statusCode).toBe(200);
    expect(meRes.json().data.username).toBe('flowuser');

    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshRes.statusCode).toBe(200);
    expect(refreshRes.json().data.accessToken).toBeTruthy();

    const logoutRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/logout',
      payload: { refreshToken },
    });
    expect(logoutRes.statusCode).toBe(200);

    const refreshAgainRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshAgainRes.statusCode).toBe(401);
  });

  it('rejects registration with a duplicate username', async () => {
    await registerUser('dupeuser');
    const secondRes = await registerUser('dupeuser');
    expect(secondRes.statusCode).toBe(409);
  });

  it('rejects login with the wrong password', async () => {
    await registerUser('wrongpassuser');
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { usernameOrEmail: 'wrongpassuser', password: 'not-the-password' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects /auth/me without a token', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/auth/me' });
    expect(res.statusCode).toBe(401);
  });

  it('rejects an expired/revoked refresh token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken: 'this-token-does-not-exist' },
    });
    expect(res.statusCode).toBe(401);
  });

  it('rejects both login and refresh for a suspended account with 403, not 401', async () => {
    const registerRes = await registerUser('suspendeduser');
    const { refreshToken } = registerRes.json().data.tokens;

    // suspendUser (admin.service.ts) deletes refresh tokens as part of
    // suspension, which would make this test pass for the wrong reason —
    // updating suspended_at directly isolates the check this test actually
    // targets from that separate defense.
    await db
      .updateTable('users')
      .set({ suspended_at: new Date() })
      .where('username', '=', 'suspendeduser')
      .execute();

    const loginRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      payload: { usernameOrEmail: 'suspendeduser', password: 'password123' },
    });
    expect(loginRes.statusCode).toBe(403);

    const refreshRes = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/refresh',
      payload: { refreshToken },
    });
    expect(refreshRes.statusCode).toBe(403);
  });

  it('does not wipe other fields when PATCH /auth/me sets only one', async () => {
    const registerRes = await registerUser('patchuser');
    const { accessToken } = registerRes.json().data.tokens;
    const auth = { authorization: `Bearer ${accessToken}` };

    const withAvatar = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me',
      headers: auth,
      payload: { avatarUrl: 'https://example.com/a.png' },
    });
    expect(withAvatar.statusCode).toBe(200);
    expect(withAvatar.json().data.avatarUrl).toBe('https://example.com/a.png');

    // Patching a different field must leave avatarUrl alone.
    //
    // updateUser spreads `{avatar_url: undefined, phone: '…'}` into
    // Kysely's .set(), which looks like it would null the column. It
    // doesn't — Kysely drops undefined keys before compiling, emitting
    // `set "phone" = $1, "updated_at" = $2` with no avatar_url clause at
    // all. This test pins that down, because the behaviour is load-bearing
    // and invisible at the call site: if updateUser is ever rewritten to
    // raw SQL, or Kysely changes this, a partial PATCH starts silently
    // wiping fields and nothing else in the suite would notice.
    const withPhone = await app.inject({
      method: 'PATCH',
      url: '/api/v1/auth/me',
      headers: auth,
      payload: { phone: '+15551234567' },
    });
    expect(withPhone.statusCode).toBe(200);
    expect(withPhone.json().data.phone).toBe('+15551234567');
    expect(withPhone.json().data.avatarUrl).toBe('https://example.com/a.png');
  });

  describe('FCM token registration', () => {
    it('registers a token and findFcmTokenForUser resolves it', async () => {
      const registerRes = await registerUser('fcmuser');
      const { accessToken } = registerRes.json().data.tokens;

      const putRes = await app.inject({
        method: 'PUT',
        url: '/api/v1/auth/fcm-token',
        headers: { authorization: `Bearer ${accessToken}` },
        payload: { fcmToken: 'token-abc' },
      });
      expect(putRes.statusCode).toBe(200);

      const row = await db
        .selectFrom('users')
        .select('fcm_token')
        .where('username', '=', 'fcmuser')
        .executeTakeFirstOrThrow();
      expect(row.fcm_token).toBe('token-abc');
    });

    it('never returns fcm_token from /auth/me', async () => {
      const registerRes = await registerUser('fcmhidden');
      const { accessToken } = registerRes.json().data.tokens;
      const auth = { authorization: `Bearer ${accessToken}` };

      await app.inject({
        method: 'PUT',
        url: '/api/v1/auth/fcm-token',
        headers: auth,
        payload: { fcmToken: 'token-hidden' },
      });

      const meRes = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: auth });
      expect(meRes.json().data.fcmToken).toBeUndefined();
      expect(meRes.json().data.fcm_token).toBeUndefined();
    });

    it('clears the token on DELETE', async () => {
      const registerRes = await registerUser('fcmdelete');
      const { accessToken } = registerRes.json().data.tokens;
      const auth = { authorization: `Bearer ${accessToken}` };

      await app.inject({
        method: 'PUT',
        url: '/api/v1/auth/fcm-token',
        headers: auth,
        payload: { fcmToken: 'token-to-delete' },
      });
      const deleteRes = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/fcm-token',
        headers: auth,
      });
      expect(deleteRes.statusCode).toBe(200);

      const row = await db
        .selectFrom('users')
        .select('fcm_token')
        .where('username', '=', 'fcmdelete')
        .executeTakeFirstOrThrow();
      expect(row.fcm_token).toBeNull();
    });

    it('rejects registration without a token', async () => {
      const res = await app.inject({ method: 'PUT', url: '/api/v1/auth/fcm-token' });
      expect(res.statusCode).toBe(401);
    });

    // The safety test of the sprint: without this, A signs out ungracefully,
    // B signs into the same physical phone, and A keeps receiving B's SOS
    // alerts because the old token is still sitting on A's row.
    it('device handoff: registering a token already held by another user clears it from that user', async () => {
      const userARes = await registerUser('deviceA');
      const { accessToken: tokenA } = userARes.json().data.tokens;
      const userBRes = await registerUser('deviceB');
      const { accessToken: tokenB } = userBRes.json().data.tokens;

      await app.inject({
        method: 'PUT',
        url: '/api/v1/auth/fcm-token',
        headers: { authorization: `Bearer ${tokenA}` },
        payload: { fcmToken: 'shared-device-token' },
      });

      const beforeHandoff = await db
        .selectFrom('users')
        .select('fcm_token')
        .where('username', '=', 'deviceA')
        .executeTakeFirstOrThrow();
      expect(beforeHandoff.fcm_token).toBe('shared-device-token');

      await app.inject({
        method: 'PUT',
        url: '/api/v1/auth/fcm-token',
        headers: { authorization: `Bearer ${tokenB}` },
        payload: { fcmToken: 'shared-device-token' },
      });

      const afterHandoffA = await db
        .selectFrom('users')
        .select('fcm_token')
        .where('username', '=', 'deviceA')
        .executeTakeFirstOrThrow();
      expect(afterHandoffA.fcm_token).toBeNull();

      const afterHandoffB = await db
        .selectFrom('users')
        .select('fcm_token')
        .where('username', '=', 'deviceB')
        .executeTakeFirstOrThrow();
      expect(afterHandoffB.fcm_token).toBe('shared-device-token');
    });
  });

  describe('auth isolation', () => {
    it('rejects a user access token on an admin-protected route', async () => {
      const registerRes = await registerUser('isolationuser');
      const { accessToken } = registerRes.json().data.tokens;

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/admin/auth/me',
        headers: { authorization: `Bearer ${accessToken}` },
      });
      expect(res.statusCode).toBe(401);
    });
  });
});
