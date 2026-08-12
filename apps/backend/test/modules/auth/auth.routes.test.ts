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
