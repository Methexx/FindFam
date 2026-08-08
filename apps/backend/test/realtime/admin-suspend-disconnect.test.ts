import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../../src/app';
import { db } from '../../src/config/db';
import { hashPassword } from '../../src/lib/password';
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

async function loginAdmin(email: string, password: string): Promise<string> {
  const passwordHash = await hashPassword(password);
  await db.insertInto('admins').values({ email, password_hash: passwordHash }).execute();
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/auth/login',
    payload: { email, password },
  });
  return res.json().data.tokens.accessToken;
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

function waitForClose(socket: WebSocket, timeoutMs = 2000): Promise<number> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Timed out waiting for close')), timeoutMs);
    socket.once('close', (code) => {
      clearTimeout(timer);
      resolve(code);
    });
  });
}

describe('admin suspend force-disconnect (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('closes an active WS connection when the user is suspended', async () => {
    baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
    wsUrl = baseUrl.replace('http://', 'ws://') + '/ws';

    const alice = await registerUser('alice_susp1');
    const adminToken = await loginAdmin('susp-admin1@example.com', 'adminpass123');

    const aliceSocket = await connectAndAuth(alice.accessToken);
    const closed = waitForClose(aliceSocket);

    const suspendRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/admin/users/${alice.userId}/suspend`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(suspendRes.statusCode).toBe(200);

    const closeCode = await closed;
    expect(closeCode).toBe(4001);
  });
});
