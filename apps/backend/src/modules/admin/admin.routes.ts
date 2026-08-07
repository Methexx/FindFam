import type { FastifyPluginAsync } from 'fastify';
import { adminLoginBodySchema } from './admin.schema';
import * as adminService from './admin.service';
import { AdminAuthError, AdminError } from './admin.service';
import { rateLimitConfig } from '../../lib/rate-limit-config';

const adminRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/admin/auth/login',
    { config: rateLimitConfig(10, '1 minute') },
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

  fastify.get(
    '/admin/sos/active',
    { preHandler: fastify.authenticateAdmin },
    async (_request, reply) => {
      const result = await adminService.listActiveSos();
      return reply.send({ data: result, error: null });
    },
  );

  fastify.get(
    '/admin/sos/:id',
    { preHandler: fastify.authenticateAdmin },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await adminService.getSosEvent(id);
        return reply.send({ data: result, error: null });
      } catch (err) {
        if (err instanceof AdminError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );
};

export default adminRoutes;
