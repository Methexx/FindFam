import type { FastifyPluginAsync } from 'fastify';
import { adminLoginBodySchema } from './admin.schema';
import * as adminService from './admin.service';
import { AdminAuthError } from './admin.service';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/admin/auth/login',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = adminLoginBodySchema.parse(request.body);
      try {
        const result = await adminService.login(body);
        return reply.send({ data: result, error: null });
      } catch (err) {
        if (err instanceof AdminAuthError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.get(
    '/admin/auth/me',
    { preHandler: fastify.authenticateAdmin },
    async (request, reply) => {
      return reply.send({ data: request.admin, error: null });
    },
  );

  fastify.get(
    '/admin/circles',
    { preHandler: fastify.authenticateAdmin },
    async (_request, reply) => {
      const result = await adminService.listCircles();
      return reply.send({ data: result, error: null });
    },
  );
};

export default adminRoutes;
