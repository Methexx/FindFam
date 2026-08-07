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

describe('emergency-contacts routes (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('rejects adding a contact without an accepted follow relationship', async () => {
    const alice = await registerUser('alice_ec1');
    await registerUser('stranger_ec1');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/emergency-contacts',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { username: 'stranger_ec1' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('adds a contact after an accepted follow and lists it', async () => {
    const alice = await registerUser('alice_ec2');
    const bob = await registerUser('bob_ec2');
    await followAndAccept(alice, bob, 'bob_ec2');

    const addRes = await app.inject({
      method: 'POST',
      url: '/api/v1/emergency-contacts',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { username: 'bob_ec2', phone: '+15551234567' },
    });
    expect(addRes.statusCode).toBe(201);
    expect(addRes.json().data.contactUserId).toBe(bob.userId);
    expect(addRes.json().data.username).toBe('bob_ec2');

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/emergency-contacts',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(listRes.statusCode).toBe(200);
    expect(listRes.json().data).toHaveLength(1);
    expect(listRes.json().data[0].username).toBe('bob_ec2');
  });

  it('rejects adding the same contact twice', async () => {
    const alice = await registerUser('alice_ec3');
    const bob = await registerUser('bob_ec3');
    await followAndAccept(alice, bob, 'bob_ec3');

    await app.inject({
      method: 'POST',
      url: '/api/v1/emergency-contacts',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { username: 'bob_ec3' },
    });

    const dupeRes = await app.inject({
      method: 'POST',
      url: '/api/v1/emergency-contacts',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { username: 'bob_ec3' },
    });
    expect(dupeRes.statusCode).toBe(409);
  });

  it('rejects adding a nonexistent username with 400', async () => {
    const alice = await registerUser('alice_ec4');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/emergency-contacts',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { username: 'does_not_exist_ec4' },
    });
    expect(res.statusCode).toBe(404);
  });

  it('removes a contact idempotently', async () => {
    const alice = await registerUser('alice_ec5');
    const bob = await registerUser('bob_ec5');
    await followAndAccept(alice, bob, 'bob_ec5');

    const addRes = await app.inject({
      method: 'POST',
      url: '/api/v1/emergency-contacts',
      headers: { authorization: `Bearer ${alice.accessToken}` },
      payload: { username: 'bob_ec5' },
    });
    const contactId = addRes.json().data.id;

    const firstDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/emergency-contacts/${contactId}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(firstDelete.statusCode).toBe(200);

    const secondDelete = await app.inject({
      method: 'DELETE',
      url: `/api/v1/emergency-contacts/${contactId}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(secondDelete.statusCode).toBe(200);
  });
});
