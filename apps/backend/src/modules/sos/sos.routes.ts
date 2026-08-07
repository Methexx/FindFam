import type { FastifyPluginAsync } from 'fastify';
import { triggerSosBodySchema } from './sos.schema';
import * as sosService from './sos.service';
import { SosError } from './sos.service';

const sosRoutes: FastifyPluginAsync = async (fastify) => {
  // No rate limit — SOS is safety-critical and must never be throttled.
  // Duplicate rapid triggers are deduplicated inside sosService.triggerSos
  // instead (dedup, not throttling — see docs/03-api-endpoints.md).
  fastify.post('/sos', { preHandler: fastify.authenticate }, async (request, reply) => {
    const body = triggerSosBodySchema.parse(request.body);
    const result = await sosService.triggerSos(request.user!.id, body);
    return reply.code(201).send({ data: result, error: null });
  });

  fastify.patch(
    '/sos/:id/resolve',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await sosService.resolveSos(request.user!.id, id);
        return reply.send({ data: result, error: null });
      } catch (err) {
        if (err instanceof SosError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.get('/sos/active', { preHandler: fastify.authenticate }, async (request, reply) => {
    const result = await sosService.listActiveForUserCircles(request.user!.id);
    return reply.send({ data: result, error: null });
  });
};

export default sosRoutes;
