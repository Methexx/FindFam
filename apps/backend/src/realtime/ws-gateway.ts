import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { z } from 'zod';
import { env } from '../config/env';
import { verifyToken } from '../lib/jwt';
import { redisPubSub } from './redis-pubsub';
import * as circlesRepository from '../modules/circles/circles.repository';
import { handleLocationUpdate } from './channels/location.channel';
import { handleMessageSend } from './channels/chat.channel';
import { handleSosTrigger } from './channels/sos.channel';

const authMessageSchema = z.object({
  type: z.literal('auth'),
  token: z.string(),
});

const adminAuthMessageSchema = z.object({
  type: z.literal('admin_auth'),
  token: z.string(),
});

const inboundMessageSchema = z.discriminatedUnion('type', [
  authMessageSchema,
  adminAuthMessageSchema,
  z.object({
    type: z.literal('location:update'),
    payload: z.unknown(),
  }),
  z.object({
    type: z.literal('message:send'),
    payload: z.unknown(),
  }),
  z.object({
    type: z.literal('sos:trigger'),
    payload: z.unknown(),
  }),
]);

function send(socket: WebSocket, data: unknown) {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(data));
}

// Mirrors the REST POST /locations limit (30/min, see lib/rate-limit-config.ts)
// so a client can't bypass that throttle by pushing location:update over WS
// instead. Per-connection, not per-user, since a user's connections don't
// share a socket to track state on.
const LOCATION_UPDATE_LIMIT = 30;
const LOCATION_UPDATE_WINDOW_MS = 60_000;

function isRateLimited(timestamps: number[]): boolean {
  if (env.NODE_ENV === 'test') return false;
  const now = Date.now();
  const windowStart = now - LOCATION_UPDATE_WINDOW_MS;
  while (timestamps.length > 0 && (timestamps[0] as number) < windowStart) {
    timestamps.shift();
  }
  if (timestamps.length >= LOCATION_UPDATE_LIMIT) {
    return true;
  }
  timestamps.push(now);
  return false;
}

// Tracks which users currently have at least one open, authenticated WS
// connection — used to decide who needs an FCM push for a chat message
// they'd otherwise miss in real time. A refcount (not a boolean) so a user
// with multiple tabs/devices open doesn't get marked offline when only one
// of their connections closes.
const connectedUserRefcounts = new Map<string, number>();

// Parallel registry of the actual sockets per user, used only for admin
// force-disconnect (suspension) — kept separate from the refcount map
// since most callers only need the boolean/count, not the sockets.
const connectedSockets = new Map<string, Set<WebSocket>>();

export function isUserConnected(userId: string): boolean {
  return (connectedUserRefcounts.get(userId) ?? 0) > 0;
}

// Closes every open, authenticated WS connection for a user — used when an
// admin suspends an account, per docs/07-data-flow.md Journey 5's
// requirement that suspension force-disconnects live sessions immediately
// rather than waiting for the socket to close naturally.
export function forceDisconnectUser(userId: string): void {
  const sockets = connectedSockets.get(userId);
  if (!sockets) return;
  for (const socket of sockets) {
    socket.close(4001, 'Account suspended');
  }
}

function markUserConnected(userId: string, socket: WebSocket) {
  connectedUserRefcounts.set(userId, (connectedUserRefcounts.get(userId) ?? 0) + 1);
  let sockets = connectedSockets.get(userId);
  if (!sockets) {
    sockets = new Set();
    connectedSockets.set(userId, sockets);
  }
  sockets.add(socket);
}

function markUserDisconnected(userId: string, socket: WebSocket) {
  const count = connectedUserRefcounts.get(userId) ?? 0;
  if (count <= 1) {
    connectedUserRefcounts.delete(userId);
  } else {
    connectedUserRefcounts.set(userId, count - 1);
  }

  const sockets = connectedSockets.get(userId);
  if (sockets) {
    sockets.delete(socket);
    if (sockets.size === 0) {
      connectedSockets.delete(userId);
    }
  }
}

/**
 * WS connection lifecycle per docs/05-realtime-channels.md:
 * 1. Client opens the connection unauthenticated.
 * 2. Client sends an `auth` message with the JWT access token (not a query
 *    param, so it never lands in proxy/access logs).
 * 3. Server verifies it using the same user-auth verification as the REST
 *    API (lib/jwt.verifyToken + env.JWT_SECRET) — no separate check.
 * 4. On success, server resolves the user's circle memberships and
 *    subscribes the connection to `circle:{circleId}:location` for each.
 * 5. On disconnect, every subscription is torn down — no lingering
 *    Redis subscriptions.
 */
const wsGateway: FastifyPluginAsync = async (fastify) => {
  fastify.get('/ws', { websocket: true }, (socket, _request: FastifyRequest) => {
    let userId: string | null = null;
    let isAdmin = false;
    const subscribedChannels = new Set<string>();
    const locationUpdateTimestamps: number[] = [];
    const forwardToClient = (message: string) => send(socket, JSON.parse(message));

    const cleanup = async () => {
      await Promise.all(
        Array.from(subscribedChannels).map((channel) =>
          redisPubSub.unsubscribe(channel, forwardToClient),
        ),
      );
      subscribedChannels.clear();
      if (userId) {
        markUserDisconnected(userId, socket);
      }
    };

    socket.on('message', async (raw: Buffer) => {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(raw.toString());
      } catch {
        return send(socket, { type: 'error', error: 'Malformed message' });
      }

      const parsed = inboundMessageSchema.safeParse(parsedJson);
      if (!parsed.success) {
        return send(socket, { type: 'error', error: 'Unrecognized message' });
      }

      // Admin connections use a distinct auth message and subscription set —
      // they verify against ADMIN_JWT_SECRET (a different secret and payload
      // shape than user tokens) and have no circle memberships to resolve,
      // mirroring the REST-side split between fastify.authenticate and
      // fastify.authenticateAdmin as two separate decorators rather than one
      // that branches on token type.
      if (parsed.data.type === 'admin_auth') {
        try {
          await verifyToken<{ sub: string; email: string }>(
            parsed.data.token,
            env.ADMIN_JWT_SECRET,
          );
          isAdmin = true;
        } catch {
          send(socket, { type: 'error', error: 'Invalid or expired admin token' });
          return socket.close();
        }

        const channel = 'admin:sos';
        subscribedChannels.add(channel);
        await redisPubSub.subscribe(channel, forwardToClient);
        return send(socket, { type: 'admin_auth:ok' });
      }

      if (parsed.data.type === 'auth') {
        try {
          const payload = await verifyToken<{ sub: string; username: string }>(
            parsed.data.token,
            env.JWT_SECRET,
          );
          userId = payload.sub;
        } catch {
          send(socket, { type: 'error', error: 'Invalid or expired token' });
          return socket.close();
        }

        markUserConnected(userId, socket);

        const circles = await circlesRepository.listCirclesForUser(userId);
        for (const circle of circles) {
          const channels = [
            `circle:${circle.id}:location`,
            `circle:${circle.id}:chat`,
            `circle:${circle.id}:sos`,
          ];
          for (const channel of channels) {
            subscribedChannels.add(channel);
            await redisPubSub.subscribe(channel, forwardToClient);
          }
        }

        return send(socket, { type: 'auth:ok' });
      }

      // Any non-auth message before auth succeeds is rejected — no
      // unauthenticated writes or subscriptions. Admin connections only
      // subscribe in this sprint (no admin-initiated triggers), so they
      // never reach this branch with a meaningful message type.
      if (!userId) {
        if (isAdmin) return;
        return send(socket, { type: 'error', error: 'Not authenticated' });
      }

      if (parsed.data.type === 'location:update') {
        if (isRateLimited(locationUpdateTimestamps)) {
          send(socket, { type: 'error', error: 'Rate limit exceeded' });
          return;
        }
        const result = await handleLocationUpdate(userId, parsedJson);
        if (!result.ok) {
          send(socket, { type: 'error', error: result.error });
        }
      }

      if (parsed.data.type === 'message:send') {
        const result = await handleMessageSend(userId, parsedJson);
        if (!result.ok) {
          send(socket, { type: 'error', error: result.error });
        }
      }

      if (parsed.data.type === 'sos:trigger') {
        const result = await handleSosTrigger(userId, parsedJson);
        if (!result.ok) {
          send(socket, { type: 'error', error: result.error });
        }
      }
    });

    socket.on('close', () => {
      void cleanup();
    });
  });
};

export default wsGateway;
