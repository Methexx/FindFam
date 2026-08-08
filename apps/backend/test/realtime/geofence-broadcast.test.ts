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

function waitForMessageOfType(socket: WebSocket, type: string, timeoutMs = 3000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out waiting for message type ${type}`)),
      timeoutMs,
    );
    const handler = (raw: Buffer) => {
      const message = JSON.parse(raw.toString());
      if (message.type === type) {
        clearTimeout(timer);
        socket.off('message', handler);
        resolve(message);
      }
    };
    socket.on('message', handler);
  });
}

describe('geofence realtime broadcast (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('publishes a geofence:event to circle members when a location update enters a geofence', async () => {
    baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    wsUrl = baseUrl.replace('http://', 'ws://') + '/ws';

    const alice = await registerUser('alice_geows1');
    const bob = await registerUser('bob_geows1');
    await followAndAccept(alice, bob, 'bob_geows1');
    const circleId = await createCircleWithMember(alice, 'bob_geows1');

    await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circleId}/geofences`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { name: 'Home', center: { lat: 37.7749, lng: -122.4194 }, radiusMeters: 200 },
    });

    const bobSocket = await connectAndAuth(bob.accessToken);
    const geofenceEventReceived = waitForMessageOfType(bobSocket, 'geofence:event');

    const locationRes = await app.inject({
      method: 'POST',
      url: '/api/v1/locations',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { lat: 37.7749, lng: -122.4194 },
    });
    expect(locationRes.statusCode).toBe(201);

    const event = await geofenceEventReceived;
    expect(event.payload.userId).toBe(alice.userId);
    expect(event.payload.geofenceName).toBe('Home');
    expect(event.payload.event).toBe('enter');

    bobSocket.close();
  });
});
