import fp from 'fastify-plugin';
import type { FastifyPluginAsync } from 'fastify';
import { env } from '../config/env';
import { verifyToken } from '../lib/jwt';
import * as authRepository from '../modules/auth/auth.repository';

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('authenticate', async (request, reply) => {
    const header = request.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;

    if (!token) {
      return reply.code(401).send({ data: null, error: 'Missing authorization token' });
    }

    try {
      const payload = await verifyToken<{ sub: string; username: string }>(token, env.JWT_SECRET);

      // Checked on every authenticated request, not just at login — a JWT
      // is otherwise stateless, so this is the only way a suspension takes
      // effect on the very next API call rather than waiting up to 15
      // minutes for the access token to expire (docs/07-data-flow.md
      // Journey 5).
      const user = await authRepository.findUserById(payload.sub);
      if (user?.suspended_at) {
        return reply.code(403).send({ data: null, error: 'Account suspended' });
      }

      request.user = { id: payload.sub, username: payload.username };
    } catch {
      return reply.code(401).send({ data: null, error: 'Invalid or expired token' });
    }
  });
};

export default fp(authPlugin, { name: 'auth' });
