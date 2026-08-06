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
