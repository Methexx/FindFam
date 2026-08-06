import type { FastifyPluginAsync } from 'fastify';
import {
  registerBodySchema,
  loginBodySchema,
  refreshBodySchema,
  patchMeBodySchema,
} from './auth.schema';
import * as authService from './auth.service';
import { AuthError } from './auth.service';
import { rateLimitConfig } from '../../lib/rate-limit-config';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/auth/register',
    { config: rateLimitConfig(5, '1 minute') },
    async (request, reply) => {
      const body = registerBodySchema.parse(request.body);
      try {
        const result = await authService.register(body);
        return reply.code(201).send({ data: result, error: null });
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.post(
    '/auth/login',
    { config: rateLimitConfig(10, '1 minute') },
    async (request, reply) => {
      const body = loginBodySchema.parse(request.body);
      try {
        const result = await authService.login(body);
        return reply.send({ data: result, error: null });
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.post('/auth/refresh', async (request, reply) => {
    const body = refreshBodySchema.parse(request.body);
    try {
      const result = await authService.refresh(body.refreshToken);
      return reply.send({ data: result, error: null });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.statusCode).send({ data: null, error: err.message });
      }
      throw err;
    }
  });

  fastify.post('/auth/logout', async (request, reply) => {
    const body = refreshBodySchema.parse(request.body);
    await authService.logout(body.refreshToken);
    return reply.send({ data: { success: true }, error: null });
  });

  fastify.get(
    '/auth/me',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = await authService.getMe(request.user!.id);
      return reply.send({ data: user, error: null });
    },
  );

  fastify.patch(
    '/auth/me',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = patchMeBodySchema.parse(request.body);
      const user = await authService.updateMe(request.user!.id, body);
      return reply.send({ data: user, error: null });
    },
  );
};

export default authRoutes;
