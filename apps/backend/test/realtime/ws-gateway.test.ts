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
    const onMessage = (raw: Buffer) => {
      clearTimeout(timer);
      reject(new Error(`Expected no message, got ${raw.toString()}`));
    };
    // Must remove the listener on the timeout path too, or it lingers and
    // silently consumes the *next* message a later waitForMessage() call
    // expects to see — the reject() above would be a no-op against an
    // already-resolved promise, but the message itself is still gone.
    const timer = setTimeout(() => {
      socket.off('message', onMessage);
      resolve();
    }, timeoutMs);
    socket.once('message', onMessage);
  });
}

describe('WS gateway realtime location broadcast (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('broadcasts a location:update to other circle members but not to an outsider', async () => {
    baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    wsUrl = baseUrl.replace('http://', 'ws://') + '/ws';

    const alice = await registerUser('alice_ws');
    const bob = await registerUser('bob_ws');
    const outsider = await registerUser('outsider_ws');
    await followAndAccept(alice, bob, 'bob_ws');
    const circleId = await createCircleWithMember(alice, 'bob_ws');

    const aliceSocket = await connectAndAuth(alice.accessToken);
    const bobSocket = await connectAndAuth(bob.accessToken);
    const outsiderSocket = await connectAndAuth(outsider.accessToken);

    const bobReceives = waitForMessage(bobSocket);
    const outsiderReceivesNothing = waitForNoMessage(outsiderSocket);

    aliceSocket.send(
      JSON.stringify({
        type: 'location:update',
        payload: { lat: 37.7749, lng: -122.4194, speed: 1.2, batteryLevel: 80 },
      }),
    );

    const bobMessage = await bobReceives;
    expect(bobMessage.type).toBe('location:broadcast');
    expect(bobMessage.payload.userId).toBe(alice.userId);
    expect(bobMessage.payload.circleId).toBe(circleId);
    expect(bobMessage.payload.lat).toBeCloseTo(37.7749, 3);
    expect(bobMessage.payload.lng).toBeCloseTo(-122.4194, 3);

    await outsiderReceivesNothing;

    aliceSocket.close();
    bobSocket.close();
    outsiderSocket.close();
  });

  it('accepts a POST /locations write independently of any open WS connection', async () => {
    const alice = await registerUser('alice_rest');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/locations',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { lat: 10, lng: 20, speed: null, batteryLevel: 55 },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.data.userId).toBe(alice.userId);
    expect(body.data.lat).toBeCloseTo(10, 5);
    expect(body.data.lng).toBeCloseTo(20, 5);
  });

  it('rejects out-of-range lat/lng with a clear error, not a silent write', async () => {
    const alice = await registerUser('alice_invalid');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/locations',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { lat: 200, lng: 20 },
    });

    expect(res.statusCode).toBe(400);
  });

  it('rejects excess location updates from the same user faster than the rate limit', async () => {
    const alice = await registerUser('alice_rate');

    const first = await app.inject({
      method: 'POST',
      url: '/api/v1/locations',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { lat: 1, lng: 1 },
    });
    expect(first.statusCode).toBe(201);

    const second = await app.inject({
      method: 'POST',
      url: '/api/v1/locations',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { lat: 2, lng: 2 },
    });
    expect(second.statusCode).toBe(429);
  });

  it('enforces circle membership on GET /circles/:id/locations/latest', async () => {
    const alice = await registerUser('alice_latest');
    const bob = await registerUser('bob_latest');
    const outsider = await registerUser('outsider_latest');
    await followAndAccept(alice, bob, 'bob_latest');
    const circleId = await createCircleWithMember(alice, 'bob_latest');

    await app.inject({
      method: 'POST',
      url: '/api/v1/locations',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { lat: 5, lng: 5 },
    });

    const memberRes = await app.inject({
      method: 'GET',
      url: `/api/v1/circles/${circleId}/locations/latest`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(memberRes.statusCode).toBe(200);
    expect(memberRes.json().data).toHaveLength(1);
    expect(memberRes.json().data[0].userId).toBe(alice.userId);

    const outsiderRes = await app.inject({
      method: 'GET',
      url: `/api/v1/circles/${circleId}/locations/latest`,
      headers: { authorization: `Bearer ${outsider.accessToken}` },
    });
    expect(outsiderRes.statusCode).toBe(404);
  });

  it('receives broadcasts for a circle joined mid-session only after circles:resync', async () => {
    const alice = await registerUser('alice_resync');
    const bob = await registerUser('bob_resync');
    await followAndAccept(alice, bob, 'bob_resync');

    // Bob connects and authenticates before the circle exists at all — his
    // subscribedChannels set is resolved from zero circles at auth time.
    const bobSocket = await connectAndAuth(bob.accessToken);

    const circleId = await createCircleWithMember(alice, 'bob_resync');

    const aliceSocket = await connectAndAuth(alice.accessToken);

    // Without a resync, Bob's original connection was never told about the
    // new circle — a broadcast to it should reach nobody on his socket.
    const bobReceivesNothingYet = waitForNoMessage(bobSocket, 800);
    aliceSocket.send(
      JSON.stringify({
        type: 'location:update',
        payload: { lat: 1, lng: 1 },
      }),
    );
    await bobReceivesNothingYet;

    const resyncOk = waitForMessage(bobSocket);
    bobSocket.send(JSON.stringify({ type: 'circles:resync' }));
    const resyncMessage = await resyncOk;
    expect(resyncMessage.type).toBe('circles:resync:ok');

    // locations.service's per-user rate limit (one accepted update per 4s)
    // isn't relaxed in test mode — a second location:update from Alice
    // inside that window is silently dropped (only an error reply to her
    // own socket), so this test needs to clear the window before proving
    // the post-resync broadcast actually reaches Bob.
    await new Promise((resolve) => setTimeout(resolve, 4100));

    const bobReceives = waitForMessage(bobSocket);
    aliceSocket.send(
      JSON.stringify({
        type: 'location:update',
        payload: { lat: 2, lng: 2 },
      }),
    );
    const bobMessage = await bobReceives;
    expect(bobMessage.type).toBe('location:broadcast');
    expect(bobMessage.payload.circleId).toBe(circleId);

    aliceSocket.close();
    bobSocket.close();
  }, 10_000);
});
