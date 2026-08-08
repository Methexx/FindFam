import type { FastifyPluginAsync } from 'fastify';
import { createGeofenceBodySchema } from './geofences.schema';
import * as geofencesService from './geofences.service';
import { GeofenceError } from './geofences.service';

const geofencesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/circles/:id/geofences',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = createGeofenceBodySchema.parse(request.body);
      try {
        const result = await geofencesService.createGeofence(request.user!.id, id, body);
        return reply.code(201).send({ data: result, error: null });
      } catch (err) {
        if (err instanceof GeofenceError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.get(
    '/circles/:id/geofences',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await geofencesService.listGeofences(request.user!.id, id);
        return reply.send({ data: result, error: null });
      } catch (err) {
        if (err instanceof GeofenceError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.delete(
    '/geofences/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await geofencesService.deleteGeofence(request.user!.id, id);
        return reply.send({ data: { success: true }, error: null });
      } catch (err) {
        if (err instanceof GeofenceError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );
};

export default geofencesRoutes;
