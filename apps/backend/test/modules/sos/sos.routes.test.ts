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

async function followAndAccept(
  follower: { accessToken: string },
  followee: { accessToken: string },
  followeeUsername: string,
) {
  const sendRes = await app.inject({
    method: 'POST',
    url: '/api/v1/follows',
    headers: { authorization: `Bearer ${follower.accessToken}` },
    payload: { followeeUsername },
  });
  const followId = sendRes.json().data.id;

  await app.inject({
    method: 'PATCH',
    url: `/api/v1/follows/${followId}`,
    headers: { authorization: `Bearer ${followee.accessToken}` },
    payload: { action: 'accept' },
  });
}

async function createCircleWithMember(
  owner: { accessToken: string },
  memberUsername: string,
): Promise<string> {
  const createRes = await app.inject({
    method: 'POST',
    url: '/api/v1/circles',
    headers: { authorization: `Bearer ${owner.accessToken}` },
    payload: { name: 'Family' },
  });
  const circleId = createRes.json().data.id;

  await app.inject({
    method: 'POST',
    url: `/api/v1/circles/${circleId}/members`,
    headers: { authorization: `Bearer ${owner.accessToken}` },
    payload: { username: memberUsername },
  });

  return circleId;
}

describe('sos routes (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('triggers an SOS and creates an active event', async () => {
    const alice = await registerUser('alice_sos1');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/sos',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { lat: 37.7749, lng: -122.4194 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json().data;
    expect(body.userId).toBe(alice.userId);
    expect(body.status).toBe('active');
    expect(body.origin.lat).toBeCloseTo(37.7749, 3);
    expect(body.origin.lng).toBeCloseTo(-122.4194, 3);
  });

  it('deduplicates a rapid duplicate trigger instead of creating a second event', async () => {
    const alice = await registerUser('alice_sos2');

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/sos',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { lat: 1, lng: 1 },
    });
    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/sos',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { lat: 2, lng: 2 },
    });

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(second.json().data.id).toBe(first.json().data.id);

    const row = await db
      .selectFrom('sos_events')
      .select(db.fn.count('id').as('count'))
      .where('user_id', '=', alice.userId)
      .executeTakeFirstOrThrow();
    expect(Number(row.count)).toBe(1);
  });

  it('resolves an SOS for the triggering user and rejects others', async () => {
    const alice = await registerUser('alice_sos3');
    const bob = await registerUser('bob_sos3');

    const triggerRes = await app.inject({
      method: 'POST',
      url: '/api/v1/sos',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { lat: 1, lng: 1 },
    });
    const eventId = triggerRes.json().data.id;

    const forbiddenRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sos/${eventId}/resolve`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(forbiddenRes.statusCode).toBe(403);

    const resolveRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sos/${eventId}/resolve`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(resolveRes.statusCode).toBe(200);
    expect(resolveRes.json().data.status).toBe('resolved');

    const doubleResolveRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/sos/${eventId}/resolve`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(doubleResolveRes.statusCode).toBe(409);
  });

  it('scopes GET /sos/active to the caller\'s circles', async () => {
    const alice = await registerUser('alice_sos4');
    const bob = await registerUser('bob_sos4');
    const outsider = await registerUser('outsider_sos4');
    await followAndAccept(alice, bob, 'bob_sos4');
    await createCircleWithMember(alice, 'bob_sos4');

    await app.inject({
      method: 'POST',
      url: '/api/v1/sos',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { lat: 1, lng: 1 },
    });

    const bobRes = await app.inject({
      method: 'GET',
      url: '/api/v1/sos/active',
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(bobRes.statusCode).toBe(200);
    expect(bobRes.json().data).toHaveLength(1);
    expect(bobRes.json().data[0].userId).toBe(alice.userId);

    const outsiderRes = await app.inject({
      method: 'GET',
      url: '/api/v1/sos/active',
      headers: { authorization: `Bearer ${outsider.accessToken}` },
    });
    expect(outsiderRes.json().data).toHaveLength(0);
  });
});
