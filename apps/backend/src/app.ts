import Fastify, { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import authPlugin from './plugins/auth';
import adminAuthPlugin from './plugins/admin-auth';
import authRoutes from './modules/auth/auth.routes';
import adminRoutes from './modules/admin/admin.routes';
import followsRoutes from './modules/follows/follows.routes';
import circlesRoutes from './modules/circles/circles.routes';

// TODO: Sprint 3+ — register remaining plugins (websocket, sentry) and module
// routes (locations, geofences, messages, emergency-contacts, sos) as they're
// implemented.

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.setErrorHandler((err, _request, reply) => {
    if (err instanceof ZodError) {
      return reply.code(400).send({ data: null, error: err.issues[0]?.message ?? 'Invalid request' });
    }
    app.log.error(err);
    return reply.code(500).send({ data: null, error: 'Internal server error' });
  });

  app.register(rateLimit, { global: false });
  app.register(authPlugin);
  app.register(adminAuthPlugin);

  app.register(authRoutes, { prefix: '/api/v1' });
  app.register(adminRoutes, { prefix: '/api/v1' });
  app.register(followsRoutes, { prefix: '/api/v1' });
  app.register(circlesRoutes, { prefix: '/api/v1' });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}
