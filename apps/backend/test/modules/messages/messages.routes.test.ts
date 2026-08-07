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

describe('messages routes (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('sends and returns a message in the expected public shape', async () => {
    const alice = await registerUser('alice_msg');
    const bob = await registerUser('bob_msg');
    await followAndAccept(alice, bob, 'bob_msg');
    const circleId = await createCircleWithMember(alice, 'bob_msg');

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circleId}/messages`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { content: 'hello circle' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json().data;
    expect(body.circleId).toBe(circleId);
    expect(body.senderId).toBe(alice.userId);
    expect(body.content).toBe('hello circle');
    expect(typeof body.sentAt).toBe('string');
  });

  it('rejects a non-member on both POST and GET', async () => {
    const alice = await registerUser('alice_msg2');
    const bob = await registerUser('bob_msg2');
    const outsider = await registerUser('outsider_msg2');
    await followAndAccept(alice, bob, 'bob_msg2');
    const circleId = await createCircleWithMember(alice, 'bob_msg2');

    const postRes = await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circleId}/messages`,
      headers: { authorization: `Bearer ${outsider.accessToken}` },
      payload: { content: 'sneaky' },
    });
    expect(postRes.statusCode).toBe(404);

    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/circles/${circleId}/messages`,
      headers: { authorization: `Bearer ${outsider.accessToken}` },
    });
    expect(getRes.statusCode).toBe(404);
  });

  it('paginates history with no duplicates or gaps across pages', async () => {
    const alice = await registerUser('alice_msg3');
    const bob = await registerUser('bob_msg3');
    await followAndAccept(alice, bob, 'bob_msg3');
    const circleId = await createCircleWithMember(alice, 'bob_msg3');

    const sentIds: string[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/circles/${circleId}/messages`,
        headers: { authorization: `Bearer ${alice.accessToken}` },
        payload: { content: `message ${i}` },
      });
      sentIds.push(res.json().data.id);
    }

    const firstPage = await app.inject({
      method: 'GET',
      url: `/api/v1/circles/${circleId}/messages?limit=2`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(firstPage.statusCode).toBe(200);
    const firstBody = firstPage.json().data;
    expect(firstBody.messages).toHaveLength(2);
    expect(firstBody.nextCursor).toBeTruthy();

    const secondPage = await app.inject({
      method: 'GET',
      url: `/api/v1/circles/${circleId}/messages?limit=2&cursor=${encodeURIComponent(firstBody.nextCursor)}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const secondBody = secondPage.json().data;
    expect(secondBody.messages).toHaveLength(2);

    const thirdPage = await app.inject({
      method: 'GET',
      url: `/api/v1/circles/${circleId}/messages?limit=2&cursor=${encodeURIComponent(secondBody.nextCursor)}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const thirdBody = thirdPage.json().data;
    expect(thirdBody.messages).toHaveLength(1);
    expect(thirdBody.nextCursor).toBeNull();

    const allIds = [
      ...firstBody.messages,
      ...secondBody.messages,
      ...thirdBody.messages,
    ].map((m: { id: string }) => m.id);
    expect(new Set(allIds).size).toBe(5);
    expect(allIds.sort()).toEqual([...sentIds].sort());
  });
});
