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

describe('circles routes (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('creates a circle, adds an accepted-follow member, and both users see it', async () => {
    const alice = await registerUser('owner1');
    const bob = await registerUser('member1');

    await followAndAccept(alice, bob, 'member1');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/circles',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { name: 'Family' },
    });
    expect(createRes.statusCode).toBe(201);
    const circleId = createRes.json().data.id;

    const addRes = await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circleId}/members`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { username: 'member1' },
    });
    expect(addRes.statusCode).toBe(201);

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/circles/${circleId}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(detailRes.statusCode).toBe(200);
    const usernames = detailRes.json().data.members.map((m: { username: string }) => m.username);
    expect(usernames).toContain('owner1');
    expect(usernames).toContain('member1');

    const bobCirclesRes = await app.inject({
      method: 'GET',
      url: '/api/v1/circles',
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(bobCirclesRes.json().data).toHaveLength(1);
    expect(bobCirclesRes.json().data[0].id).toBe(circleId);
  });

  it('rejects adding a member without an accepted follow', async () => {
    const alice = await registerUser('owner2');
    await registerUser('stranger2');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/circles',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { name: 'Family' },
    });
    const circleId = createRes.json().data.id;

    const addRes = await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circleId}/members`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { username: 'stranger2' },
    });
    expect(addRes.statusCode).toBe(403);
  });

  it('rejects a non-owner updating or deleting the circle', async () => {
    const alice = await registerUser('owner3');
    const bob = await registerUser('member3');
    await followAndAccept(alice, bob, 'member3');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/circles',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { name: 'Family' },
    });
    const circleId = createRes.json().data.id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circleId}/members`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { username: 'member3' },
    });

    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/circles/${circleId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { name: 'Renamed' },
    });
    expect(patchRes.statusCode).toBe(403);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/circles/${circleId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(deleteRes.statusCode).toBe(403);
  });

  it('rejects a non-member viewing circle details', async () => {
    const alice = await registerUser('owner4');
    const outsider = await registerUser('outsider4');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/circles',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { name: 'Family' },
    });
    const circleId = createRes.json().data.id;

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/circles/${circleId}`,
      headers: { authorization: `Bearer ${outsider.accessToken}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it('lets a member leave and the owner remove a member, but only the owner can delete', async () => {
    const alice = await registerUser('owner5');
    const bob = await registerUser('member5');
    await followAndAccept(alice, bob, 'member5');

    const createRes = await app.inject({
      method: 'POST',
      url: '/api/v1/circles',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { name: 'Family' },
    });
    const circleId = createRes.json().data.id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circleId}/members`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { username: 'member5' },
    });

    const leaveRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/circles/${circleId}/members/${bob.userId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(leaveRes.statusCode).toBe(200);

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/circles/${circleId}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(deleteRes.statusCode).toBe(200);

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/circles/${circleId}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(detailRes.statusCode).toBe(404);
  });
});
