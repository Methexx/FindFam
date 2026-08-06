import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env';
import { verifyToken } from '../lib/jwt';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async (request, reply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

    if (!token) {
      return reply.code(401).send({ data: null, error: 'Missing authorization token' });
    }

    try {
      const payload = await verifyToken<{ sub: string; username: string }>(token, env.JWT_SECRET);
      request.user = { id: payload.sub, username: payload.username };
    } catch {
      return reply.code(401).send({ data: null, error: 'Invalid or expired token' });
    }
  });
};

export default fp(authPlugin, { name: 'auth' });
