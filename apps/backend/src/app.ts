import Fastify, { type FastifyInstance } from 'fastify';

// TODO: Sprint 1+ — register plugins (auth, admin-auth, websocket, rate-limit, sentry)
// and module routes (auth, follows, circles, locations, geofences, messages,
// emergency-contacts, sos, admin) as they're implemented.

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: true });

  app.get('/health', async () => {
    return { status: 'ok' };
  });

  return app;
}
