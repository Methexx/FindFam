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
      const payload = await verifyToken<{ sub: string; email: string }>(
        token,
        env.ADMIN_JWT_SECRET,
      );
      request.admin = { id: payload.sub, email: payload.email };
    } catch {
      return reply.code(401).send({ data: null, error: 'Invalid or expired token' });
    }
  });
};

export default fp(adminAuthPlugin, { name: 'admin-auth' });
