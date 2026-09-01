import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import { sql } from 'kysely';
import { ZodError } from 'zod';
import { env } from './config/env';
import { initSentry, captureException } from './plugins/sentry';
import authPlugin from './plugins/auth';
import adminAuthPlugin from './plugins/admin-auth';
import websocketPlugin from './plugins/websocket';
import authRoutes from './modules/auth/auth.routes';
import adminRoutes from './modules/admin/admin.routes';
import followsRoutes from './modules/follows/follows.routes';
import circlesRoutes from './modules/circles/circles.routes';
import locationsRoutes from './modules/locations/locations.routes';
import messagesRoutes from './modules/messages/messages.routes';
import emergencyContactsRoutes from './modules/emergency-contacts/emergency-contacts.routes';
import sosRoutes from './modules/sos/sos.routes';
import geofencesRoutes from './modules/geofences/geofences.routes';
import wsGateway from './realtime/ws-gateway';
import { db } from './config/db';
import { redisPubSub } from './realtime/redis-pubsub';

export function buildApp(): FastifyInstance {
  initSentry();
  const app = Fastify({ logger: true });

  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ data: null, error: err.issues[0]?.message ?? 'Invalid request' });
    }
    captureException(err);
    app.log.error(err);
    return reply.code(500).send({ data: null, error: 'Internal server error' });
  });

  app.register(cors, { origin: env.ALLOWED_ORIGINS });
  app.register(rateLimit, { global: false });
  // 5MB cap matches the avatar-upload size check in lib/supabase-storage.ts
  // — enforced here too so an oversized upload is rejected before the file
  // is even fully buffered, not after.
  app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } });
  app.register(authPlugin);
  app.register(adminAuthPlugin);
  app.register(websocketPlugin);

  app.register(authRoutes, { prefix: '/api/v1' });
  app.register(adminRoutes, { prefix: '/api/v1' });
  app.register(followsRoutes, { prefix: '/api/v1' });
  app.register(circlesRoutes, { prefix: '/api/v1' });
  app.register(locationsRoutes, { prefix: '/api/v1' });
  app.register(messagesRoutes, { prefix: '/api/v1' });
  app.register(emergencyContactsRoutes, { prefix: '/api/v1' });
  app.register(sosRoutes, { prefix: '/api/v1' });
  app.register(geofencesRoutes, { prefix: '/api/v1' });
  app.register(wsGateway);

  app.get('/health', async (_request, reply) => {
    const [dbReachable, redisReachable] = await Promise.all([
      sql`SELECT 1`
        .execute(db)
        .then(() => true)
        .catch(() => false),
      redisPubSub.ping(),
    ]);

    const healthy = dbReachable && redisReachable;
    return reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      dependencies: {
        database: dbReachable ? 'reachable' : 'unreachable',
        redis: redisReachable ? 'reachable' : 'unreachable',
      },
    });
  });

  return app;
}
