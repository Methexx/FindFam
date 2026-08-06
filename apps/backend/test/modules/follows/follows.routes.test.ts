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

describe('follows routes (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('runs the full send -> accept flow, visible to both users', async () => {
    const alice = await registerUser('alice');
    const bob = await registerUser('bob');

    const sendRes = await app.inject({
      method: 'POST',
      url: '/api/v1/follows',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { followeeUsername: 'bob' },
    });
    expect(sendRes.statusCode).toBe(201);
    const followId = sendRes.json().data.id;

    const pendingRes = await app.inject({
      method: 'GET',
      url: '/api/v1/follows/pending',
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(pendingRes.statusCode).toBe(200);
    expect(pendingRes.json().data).toHaveLength(1);
    expect(pendingRes.json().data[0].id).toBe(followId);

    const acceptRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/follows/${followId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { action: 'accept' },
    });
    expect(acceptRes.statusCode).toBe(200);
    expect(acceptRes.json().data.status).toBe('accepted');

    const aliceFollowsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/follows',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(aliceFollowsRes.json().data).toHaveLength(1);

    const bobFollowsRes = await app.inject({
      method: 'GET',
      url: '/api/v1/follows',
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(bobFollowsRes.json().data).toHaveLength(1);
  });

  it('rejects a response from someone other than the followee', async () => {
    const alice = await registerUser('alice2');
    const bob = await registerUser('bob2');
    const carol = await registerUser('carol2');

    const sendRes = await app.inject({
      method: 'POST',
      url: '/api/v1/follows',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { followeeUsername: 'bob2' },
    });
    const followId = sendRes.json().data.id;

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/follows/${followId}`,
      headers: { authorization: `Bearer ${carol.accessToken}` },
      payload: { action: 'accept' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects following yourself', async () => {
    const alice = await registerUser('alice3');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/follows',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { followeeUsername: 'alice3' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects a duplicate follow request', async () => {
    const alice = await registerUser('alice4');
    await registerUser('bob4');

    await app.inject({
      method: 'POST',
      url: '/api/v1/follows',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { followeeUsername: 'bob4' },
    });

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/follows',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { followeeUsername: 'bob4' },
    });
    expect(res.statusCode).toBe(409);
  });
});
