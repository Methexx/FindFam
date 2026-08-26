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

async function createCircle(user: { accessToken: string }, name: string) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/circles',
    headers: { authorization: `Bearer ${user.accessToken}` },
    payload: { name },
  });
  return res.json().data as { id: string; inviteCode: string };
}

function join(user: { accessToken: string }, code: string) {
  return app.inject({
    method: 'POST',
    url: '/api/v1/circles/join',
    headers: { authorization: `Bearer ${user.accessToken}` },
    payload: { code },
  });
}

describe('circle invite codes (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('issues an invite code on create, of 8 unambiguous characters', async () => {
    const alice = await registerUser('inviteowner1');
    const circle = await createCircle(alice, 'Family');

    expect(circle.inviteCode).toMatch(/^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{8}$/);
  });

  it('lets a user with the code join without any follow relationship', async () => {
    const alice = await registerUser('inviteowner2');
    const bob = await registerUser('invitejoiner2');
    const circle = await createCircle(alice, 'Family');

    // Deliberately no follow between the two — the code IS the consent path,
    // which is what separates joining from being added by somebody else.
    const joinRes = await join(bob, circle.inviteCode);
    expect(joinRes.statusCode).toBe(201);

    const listRes = await app.inject({
      method: 'GET',
      url: '/api/v1/circles',
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(listRes.json().data).toHaveLength(1);
    expect(listRes.json().data[0].id).toBe(circle.id);

    const detailRes = await app.inject({
      method: 'GET',
      url: `/api/v1/circles/${circle.id}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    const usernames = detailRes.json().data.members.map((m: { username: string }) => m.username);
    expect(usernames).toContain('invitejoiner2');
  });

  it('accepts a lowercase or padded code', async () => {
    const alice = await registerUser('inviteowner3');
    const bob = await registerUser('invitejoiner3');
    const circle = await createCircle(alice, 'Family');

    const joinRes = await join(bob, `  ${circle.inviteCode.toLowerCase()} `);
    expect(joinRes.statusCode).toBe(201);
  });

  it('rejects an unknown code with 404', async () => {
    const bob = await registerUser('invitejoiner4');

    const joinRes = await join(bob, 'ZZZZZZZZ');
    expect(joinRes.statusCode).toBe(404);
    expect(joinRes.json().error).toBe('Invalid invite code');
  });

  it('rejects joining a circle you are already in with 409', async () => {
    const alice = await registerUser('inviteowner5');
    const circle = await createCircle(alice, 'Family');

    const joinRes = await join(alice, circle.inviteCode);
    expect(joinRes.statusCode).toBe(409);
  });

  it('rejects the code of a soft-deleted circle with 404', async () => {
    const alice = await registerUser('inviteowner6');
    const bob = await registerUser('invitejoiner6');
    const circle = await createCircle(alice, 'Family');

    await app.inject({
      method: 'DELETE',
      url: `/api/v1/circles/${circle.id}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });

    const joinRes = await join(bob, circle.inviteCode);
    expect(joinRes.statusCode).toBe(404);
  });

  it('returns the invite code to the owner and null to a member', async () => {
    const alice = await registerUser('inviteowner7');
    const bob = await registerUser('invitejoiner7');
    const circle = await createCircle(alice, 'Family');
    await join(bob, circle.inviteCode);

    const ownerView = await app.inject({
      method: 'GET',
      url: `/api/v1/circles/${circle.id}`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(ownerView.json().data.inviteCode).toBe(circle.inviteCode);

    const memberView = await app.inject({
      method: 'GET',
      url: `/api/v1/circles/${circle.id}`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(memberView.json().data.inviteCode).toBeNull();
  });

  it('rotates the code as owner, invalidating the previous one', async () => {
    const alice = await registerUser('inviteowner8');
    const bob = await registerUser('invitejoiner8');
    const circle = await createCircle(alice, 'Family');

    const rotateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circle.id}/invite-code/rotate`,
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(rotateRes.statusCode).toBe(200);

    const newCode = rotateRes.json().data.inviteCode as string;
    expect(newCode).not.toBe(circle.inviteCode);

    const staleRes = await join(bob, circle.inviteCode);
    expect(staleRes.statusCode).toBe(404);

    const freshRes = await join(bob, newCode);
    expect(freshRes.statusCode).toBe(201);
  });

  it('refuses rotation by a non-owner member with 403', async () => {
    const alice = await registerUser('inviteowner9');
    const bob = await registerUser('invitejoiner9');
    const circle = await createCircle(alice, 'Family');
    await join(bob, circle.inviteCode);

    const rotateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circle.id}/invite-code/rotate`,
      headers: { authorization: `Bearer ${bob.accessToken}` },
    });
    expect(rotateRes.statusCode).toBe(403);
  });

  it('refuses rotation by a non-member with 404, not 403', async () => {
    const alice = await registerUser('inviteowner10');
    const carol = await registerUser('outsider10');
    const circle = await createCircle(alice, 'Family');

    // The same "not found" a nonexistent circle gets — an outsider must not
    // be able to confirm a private circle exists, which a 403 would.
    const rotateRes = await app.inject({
      method: 'POST',
      url: `/api/v1/circles/${circle.id}/invite-code/rotate`,
      headers: { authorization: `Bearer ${carol.accessToken}` },
    });
    expect(rotateRes.statusCode).toBe(404);
  });

  it('mints a ws-scoped token for an authenticated user', async () => {
    const alice = await registerUser('wstokenuser1');

    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/ws-token',
      headers: { authorization: `Bearer ${alice.accessToken}` },
    });
    expect(res.statusCode).toBe(200);

    const token = res.json().data.token as string;
    expect(typeof token).toBe('string');

    const payload = JSON.parse(Buffer.from(token.split('.')[1] as string, 'base64url').toString());
    expect(payload.sub).toBe(alice.userId);
    expect(payload.aud).toBe('ws');
  });

  it('refuses to mint a ws token without a session', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/v1/auth/ws-token' });
    expect(res.statusCode).toBe(401);
  });
});
