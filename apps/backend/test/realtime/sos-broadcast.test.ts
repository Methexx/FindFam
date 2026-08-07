import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../../src/app';
import { db } from '../../src/config/db';
import { env } from '../../src/config/env';
import { signToken } from '../../src/lib/jwt';
import { sosQueue } from '../../src/queue/sos.queue';
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

function connectAndAdminAuth(token: string): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    socket.once('open', () => {
      socket.send(JSON.stringify({ type: 'admin_auth', token }));
    });
    socket.once('message', (raw) => {
      const message = JSON.parse(raw.toString());
      if (message.type === 'admin_auth:ok') {
        resolve(socket);
      } else {
        reject(new Error(`Expected admin_auth:ok, got ${JSON.stringify(message)}`));
      }
    });
    socket.once('error', reject);
  });
}

function waitForClose(socket: WebSocket, timeoutMs = 2000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for close')), timeoutMs);
    socket.once('close', () => {
      clearTimeout(timer);
      resolve();
    });
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

describe('SOS realtime broadcast (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('broadcasts sos:trigger to a circle member but not an outsider, and enqueues a delivery job', async () => {
    baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    wsUrl = baseUrl.replace('http://', 'ws://') + '/ws';

    const alice = await registerUser('alice_sosws1');
    const bob = await registerUser('bob_sosws1');
    const outsider = await registerUser('outsider_sosws1');
    await followAndAccept(alice, bob, 'bob_sosws1');
    await createCircleWithMember(alice, 'bob_sosws1');

    const aliceSocket = await connectAndAuth(alice.accessToken);
    const bobSocket = await connectAndAuth(bob.accessToken);
    const outsiderSocket = await connectAndAuth(outsider.accessToken);

    const bobReceives = waitForMessage(bobSocket);
    const outsiderReceivesNothing = waitForNoMessage(outsiderSocket);

    const countsBefore = await sosQueue.getJobCounts();
    const totalBefore = Object.values(countsBefore).reduce((a, b) => a + b, 0);

    aliceSocket.send(
      JSON.stringify({ type: 'sos:trigger', payload: { lat: 10, lng: 20 } }),
    );

    const bobMessage = await bobReceives;
    expect(bobMessage.type).toBe('sos:broadcast');
    expect(bobMessage.payload.userId).toBe(alice.userId);
    expect(bobMessage.payload.status).toBe('active');

    await outsiderReceivesNothing;

    const countsAfter = await sosQueue.getJobCounts();
    const totalAfter = Object.values(countsAfter).reduce((a, b) => a + b, 0);
    expect(totalAfter).toBe(totalBefore + 1);

    aliceSocket.close();
    bobSocket.close();
    outsiderSocket.close();
  });

  it('delivers sos:broadcast to a valid admin_auth connection on admin:sos', async () => {
    const alice = await registerUser('alice_sosws2');
    const adminToken = await signToken({ sub: 'admin-id', email: 'admin@example.com' }, env.ADMIN_JWT_SECRET, '8h');

    const aliceSocket = await connectAndAuth(alice.accessToken);
    const adminSocket = await connectAndAdminAuth(adminToken);

    const adminReceives = waitForMessage(adminSocket);

    aliceSocket.send(JSON.stringify({ type: 'sos:trigger', payload: { lat: 1, lng: 1 } }));

    const adminMessage = await adminReceives;
    expect(adminMessage.type).toBe('sos:broadcast');
    expect(adminMessage.payload.userId).toBe(alice.userId);

    aliceSocket.close();
    adminSocket.close();
  });

  it('closes the connection on an invalid admin token', async () => {
    const socket = new WebSocket(wsUrl);
    await new Promise((resolve) => socket.once('open', resolve));
    const closed = waitForClose(socket);
    socket.send(JSON.stringify({ type: 'admin_auth', token: 'not-a-real-token' }));
    await closed;
  });

  it('never sends admin:sos traffic to a regular authenticated user connection', async () => {
    const alice = await registerUser('alice_sosws3');
    const bob = await registerUser('bob_sosws3');

    const aliceSocket = await connectAndAuth(alice.accessToken);
    const bobSocket = await connectAndAuth(bob.accessToken);

    const bobReceivesNothing = waitForNoMessage(bobSocket);
    aliceSocket.send(JSON.stringify({ type: 'sos:trigger', payload: { lat: 5, lng: 5 } }));

    await bobReceivesNothing;

    aliceSocket.close();
    bobSocket.close();
  });
});
