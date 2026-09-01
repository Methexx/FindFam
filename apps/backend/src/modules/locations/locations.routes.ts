import type { FastifyPluginAsync } from 'fastify';
import { postLocationBodySchema, updateSharingStatusBodySchema } from './locations.schema';
import * as locationsService from './locations.service';
import { LocationError } from './locations.service';
import { rateLimitConfig } from '../../lib/rate-limit-config';

const locationsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/locations',
    { preHandler: fastify.authenticate, config: rateLimitConfig(30, '1 minute') },
    async (request, reply) => {
      const body = postLocationBodySchema.parse(request.body);
      try {
        const result = await locationsService.submitLocation({
          userId: request.user!.id,
          ...body,
        });
        return reply.code(201).send({ data: result, error: null });
      } catch (err) {
        if (err instanceof LocationError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.get(
    '/circles/:id/locations/latest',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await locationsService.getLatestLocationsForCircle(request.user!.id, id);
        return reply.send({ data: result, error: null });
      } catch (err) {
        if (err instanceof LocationError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.get(
    '/locations/latest',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const result = await locationsService.getLatestLocationForSelf(request.user!.id);
      return reply.send({ data: result, error: null });
    },
  );

  fastify.patch(
    '/locations/sharing-status',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = updateSharingStatusBodySchema.parse(request.body);
      const result = await locationsService.updateSharingStatus(request.user!.id, body.isSharing);
      return reply.send({ data: result, error: null });
    },
  );
};

export default locationsRoutes;
