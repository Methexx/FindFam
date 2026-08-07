import type { FastifyPluginAsync, FastifyRequest } from 'fastify';
import type { WebSocket } from 'ws';
import { z } from 'zod';
import { env } from '../config/env';
import { verifyToken } from '../lib/jwt';
import { redisPubSub } from './redis-pubsub';
import * as circlesRepository from '../modules/circles/circles.repository';
import { handleLocationUpdate } from './channels/location.channel';

const authMessageSchema = z.object({
  type: z.literal('auth'),
  token: z.string(),
});

const inboundMessageSchema = z.discriminatedUnion('type', [
  authMessageSchema,
  z.object({
    type: z.literal('location:update'),
    payload: z.unknown(),
  }),
]);

function send(socket: WebSocket, data: unknown) {
  if (socket.readyState !== socket.OPEN) return;
  socket.send(JSON.stringify(data));
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
    const subscribedChannels = new Set<string>();
    const forwardToClient = (message: string) => send(socket, JSON.parse(message));

    const cleanup = async () => {
      await Promise.all(
        Array.from(subscribedChannels).map((channel) =>
          redisPubSub.unsubscribe(channel, forwardToClient),
        ),
      );
      subscribedChannels.clear();
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

        const circles = await circlesRepository.listCirclesForUser(userId);
        for (const circle of circles) {
          const channel = `circle:${circle.id}:location`;
          subscribedChannels.add(channel);
          await redisPubSub.subscribe(channel, forwardToClient);
        }

        return send(socket, { type: 'auth:ok' });
      }

      // Any non-auth message before auth succeeds is rejected — no
      // unauthenticated writes or subscriptions.
      if (!userId) {
        return send(socket, { type: 'error', error: 'Not authenticated' });
      }

      if (parsed.data.type === 'location:update') {
        const result = await handleLocationUpdate(userId, parsedJson);
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
