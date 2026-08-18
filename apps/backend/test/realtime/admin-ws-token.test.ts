import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import WebSocket from 'ws';
import { buildApp } from '../../src/app';
import { db } from '../../src/config/db';
import { hashPassword } from '../../src/lib/password';
import { truncateAll } from '../setup';

const app = buildApp();
let baseUrl: string;
let wsUrl: string;

async function createAndLoginAdmin(email: string, password: string): Promise<string> {
  const passwordHash = await hashPassword(password);
  await db.insertInto('admins').values({ email, password_hash: passwordHash }).execute();
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/admin/auth/login',
    payload: { email, password },
  });
  return res.json().data.tokens.accessToken;
}

function connectAndAdminAuth(token: string): Promise<{ socket: WebSocket; message: any }> {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(wsUrl);
    socket.once('open', () => {
      socket.send(JSON.stringify({ type: 'admin_auth', token }));
    });
    socket.once('message', (raw) => {
      resolve({ socket, message: JSON.parse(raw.toString()) });
    });
    socket.once('error', reject);
  });
}

describe('admin WS token scoping (integration)', () => {
  beforeEach(async () => {
    await truncateAll();
    if (!baseUrl) {
      baseUrl = await app.listen({ port: 0, host: '127.0.0.1' });
      wsUrl = baseUrl.replace('http://', 'ws://') + '/ws';
    }
  });

  afterAll(async () => {
    await app.close();
    await db.destroy();
  });

  it('mints a ws-scoped token via POST /admin/auth/ws-token that authenticates over WS', async () => {
    const sessionToken = await createAndLoginAdmin('wstoken-admin1@example.com', 'adminpass123');

    const mintRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/ws-token',
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    expect(mintRes.statusCode).toBe(200);
    const wsToken = mintRes.json().data.token;
    expect(wsToken).toBeTruthy();

    const { socket, message } = await connectAndAdminAuth(wsToken);
    expect(message.type).toBe('admin_auth:ok');
    socket.close();
  });

  it('rejects a full 8h admin session token over WS admin_auth', async () => {
    const sessionToken = await createAndLoginAdmin('wstoken-admin2@example.com', 'adminpass123');

    const { socket, message } = await connectAndAdminAuth(sessionToken);
    expect(message.type).toBe('error');
    socket.close();
  });

  it('rejects a ws-scoped token on a regular admin REST route', async () => {
    const sessionToken = await createAndLoginAdmin('wstoken-admin3@example.com', 'adminpass123');

    const mintRes = await app.inject({
      method: 'POST',
      url: '/api/v1/admin/auth/ws-token',
      headers: { authorization: `Bearer ${sessionToken}` },
    });
    const wsToken = mintRes.json().data.token;

    const meRes = await app.inject({
      method: 'GET',
      url: '/api/v1/admin/auth/me',
      headers: { authorization: `Bearer ${wsToken}` },
    });
    expect(meRes.statusCode).toBe(401);
  });
});
