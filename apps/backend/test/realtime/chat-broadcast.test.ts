import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../../src/app';
import { db } from '../../src/config/db';
import { truncateAll } from '../setup';

const app = buildApp();
let baseUrl: string;
let wsUrl: string;

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

function connectAndAuth(accessToken: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    socket.once('open', () => {
      socket.send(JSON.stringify({ type: 'auth', token: accessToken }));
    });
    socket.once('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'auth:ok') {
        resolve(socket);
      } else {
        reject(new Error(`Expected auth:ok, got ${JSON.stringify(message)}`));
      }
    });
    socket.once('error', reject);
  });
}

function waitForMessage(socket: WebSocket, timeoutMs = 2000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for message')), timeoutMs);
    socket.once('message', (raw) => {
      clearTimeout(timer);
      resolve(JSON.parse(raw.toString()));
    });
  });
}

function waitForNoMessage(socket: WebSocket, timeoutMs = 1500): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, timeoutMs);
    socket.once('message', (raw) => {
      clearTimeout(timer);
      reject(new Error(`Expected no message, got ${raw.toString()}`));
    });
  });
}

describe('chat realtime broadcast (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('broadcasts message:send to a circle member but not an outsider', async () => {
    baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    wsUrl = baseUrl.replace('http://', 'ws://') + '/ws';

    const alice = await registerUser('alice_chatws1');
    const bob = await registerUser('bob_chatws1');
    const outsider = await registerUser('outsider_chatws1');
    await followAndAccept(alice, bob, 'bob_chatws1');
    const circleId = await createCircleWithMember(alice, 'bob_chatws1');

    const aliceSocket = await connectAndAuth(alice.accessToken);
    const bobSocket = await connectAndAuth(bob.accessToken);
    const outsiderSocket = await connectAndAuth(outsider.accessToken);

    const bobReceives = waitForMessage(bobSocket);
    const outsiderReceivesNothing = waitForNoMessage(outsiderSocket);

    aliceSocket.send(
      JSON.stringify({ type: 'message:send', payload: { circleId, content: 'hi bob' } }),
    );

    const bobMessage = await bobReceives;
    expect(bobMessage.type).toBe('message:broadcast');
    expect(bobMessage.payload.senderId).toBe(alice.userId);
    expect(bobMessage.payload.content).toBe('hi bob');

    await outsiderReceivesNothing;

    aliceSocket.close();
    bobSocket.close();
    outsiderSocket.close();
  });

  it('rejects message:send from a non-member and creates no row', async () => {
    const alice = await registerUser('alice_chatws2');
    const bob = await registerUser('bob_chatws2');
    const outsider = await registerUser('outsider_chatws2');
    await followAndAccept(alice, bob, 'bob_chatws2');
    const circleId = await createCircleWithMember(alice, 'bob_chatws2');

    const outsiderSocket = await connectAndAuth(outsider.accessToken);
    const errorReceived = waitForMessage(outsiderSocket);

    outsiderSocket.send(
      JSON.stringify({ type: 'message:send', payload: { circleId, content: 'sneaky' } }),
    );

    const errorMessage = await errorReceived;
    expect(errorMessage.type).toBe('error');

    const row = await db
      .selectFrom('messages')
      .select(db.fn.count('id').as('count'))
      .where('circle_id', '=', circleId)
      .executeTakeFirstOrThrow();
    expect(Number(row.count)).toBe(0);

    outsiderSocket.close();
  });
});
