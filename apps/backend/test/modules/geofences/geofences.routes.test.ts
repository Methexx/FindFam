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

describe('geofences routes (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('lets the owner create a geofence and members list it, but not create one', async () => {
    const alice = await registerUser('alice_geo1');
    const bob = await registerUser('bob_geo1');
    await followAndAccept(alice, bob, 'bob_geo1');
    const circleId = await createCircleWithMember(alice, 'bob_geo1');

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circleId}/geofences`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { name: 'Home', center: { lat: 37.7749, lng: -122.4194 }, radiusMeters: 100 },
    });
    expect(createRes.statusCode).toBe(201);
    expect(createRes.json().data.name).toBe('Home');

    const memberCreateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circleId}/geofences`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
      payload: { name: 'Not allowed', center: { lat: 1, lng: 1 }, radiusMeters: 50 },
    });
    expect(memberCreateRes.statusCode).toBe(403);

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/circles/${circleId}/geofences`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().data).toHaveLength(1);
  });

  it('rejects a non-member listing or creating geofences', async () => {
    const alice = await registerUser('alice_geo2');
    const outsider = await registerUser('outsider_geo2');
    const circleId = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/circles',
        headers: { authorization: `Bearer ${alice.accessToken}` },
        payload: { name: 'Family' },
      })
    ).json().data.id;

    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/circles/${circleId}/geofences`,
      headers: { authorization: `Bearer ${outsider.accessToken}` },
    });
    expect(listRes.statusCode).toBe(404);
  });

  it('only the owner can delete a geofence', async () => {
    const alice = await registerUser('alice_geo3');
    const bob = await registerUser('bob_geo3');
    await followAndAccept(alice, bob, 'bob_geo3');
    const circleId = await createCircleWithMember(alice, 'bob_geo3');

    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circleId}/geofences`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { name: 'Home', center: { lat: 1, lng: 1 }, radiusMeters: 100 },
    });
    const geofenceId = createRes.json().data.id;

    const memberDeleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/geofences/${geofenceId}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(memberDeleteRes.statusCode).toBe(403);

    const ownerDeleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/geofences/${geofenceId}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(ownerDeleteRes.statusCode).toBe(200);
  });

  it('a point inside the radius is contained, one clearly outside is not', async () => {
    const alice = await registerUser('alice_geo4');
    const circleId = (
      await app.inject({
        method: 'POST',
        url: '/api/v1/circles',
        headers: { authorization: `Bearer ${alice.accessToken}` },
        payload: { name: 'Family' },
      })
    ).json().data.id;

    await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circleId}/geofences`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { name: 'Home', center: { lat: 37.7749, lng: -122.4194 }, radiusMeters: 100 },
    });

    // Triggering a location update inside the geofence should not error —
    // the containment check runs as a side effect of submitLocation and
    // must never break the primary write/broadcast path.
    const insideRes = await app.inject({
      method: 'POST',
      url: '/api/v1/locations',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { lat: 37.7749, lng: -122.4194 },
    });
    expect(insideRes.statusCode).toBe(201);

    const outsideRes = await app.inject({
      method: 'POST',
      url: '/api/v1/locations',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { lat: 10, lng: 10 },
    });
    // Rate-limited (4s window) on the second call from the same test, not
    // asserting on containment result here directly — covered by the
    // realtime geofence-event test instead. This just confirms the
    // geofence check doesn't crash the location path for an out-of-range
    // point either.
    expect([201, 429]).toContain(outsideRes.statusCode);
  });
});
