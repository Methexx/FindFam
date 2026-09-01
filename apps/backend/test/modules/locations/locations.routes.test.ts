import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { buildApp } from '../../../src/app';
import { db } from '../../../src/config/db';
import { truncateAll } from '../../setup';

const app = buildApp();

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

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  await app.close();
  await db.destroy();
});

describe('locations routes — sharing status (integration)', () => {
  it('persists the sharing toggle and reflects it on /auth/me', async () => {
    const alice = await registerUser('alice_share1');

    const initialRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(initialRes.json().data.isSharing).toBe(true);

    const offRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/locations/sharing-status',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { isSharing: false },
    });
    expect(offRes.statusCode).toBe(200);
    expect(offRes.json().data.isSharing).toBe(false);

    const afterOffRes = await app.inject({
      method: 'GET',
      url: '/api/v1/auth/me',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(afterOffRes.json().data.isSharing).toBe(false);

    const onRes = await app.inject({
      method: 'PATCH',
      url: '/api/v1/locations/sharing-status',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { isSharing: true },
    });
    expect(onRes.json().data.isSharing).toBe(true);
  });
});

describe('GET /locations/latest — self, no circle required (integration)', () => {
  it('returns null before any location has been submitted, then the latest fix after', async () => {
    const alice = await registerUser('alice_selfloc1');

    const beforeRes = await app.inject({
      method: 'GET',
      url: '/api/v1/locations/latest',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(beforeRes.statusCode).toBe(200);
    expect(beforeRes.json().data).toBeNull();

    const postRes = await app.inject({
      method: 'POST',
      url: '/api/v1/locations',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { lat: 37.7749, lng: -122.4194 },
    });
    expect(postRes.statusCode).toBe(201);

    const afterRes = await app.inject({
      method: 'GET',
      url: '/api/v1/locations/latest',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(afterRes.statusCode).toBe(200);
    expect(afterRes.json().data).toMatchObject({
      userId: alice.userId,
      lat: 37.7749,
      lng: -122.4194,
    });
  });
});
