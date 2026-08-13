import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env';
import { verifyToken } from '../lib/jwt';

const adminAuthPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticateAdmin', async (request, reply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

    if (!token) {
      return reply.code(401).send({ data: null, error: 'Missing authorization token' });
    }

    try {
      const payload = await verifyToken<{ sub: string; email: string; aud?: string }>(
        token,
        env.ADMIN_JWT_SECRET,
      );
      // A ws-scoped token (see POST /admin/auth/ws-token) is deliberately
      // narrower than a full session token — it must not double as a
      // general-purpose admin credential just because it verifies against
      // the same secret.
      if (payload.aud === 'ws') {
        return reply.code(401).send({ data: null, error: 'Invalid or expired token' });
      }
      request.admin = { id: payload.sub, email: payload.email };
    } catch {
      return reply.code(401).send({ data: null, error: 'Invalid or expired token' });
    }
  });
};

export default fp(adminAuthPlugin, { name: 'admin-auth' });
