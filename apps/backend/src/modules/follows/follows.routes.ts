import type { FastifyPluginAsync } from 'fastify';
import { sendFollowBodySchema, patchFollowBodySchema } from './follows.schema';
import * as followsService from './follows.service';
import { FollowError } from './follows.service';

const followsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/follows',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = sendFollowBodySchema.parse(request.body);
      try {
        const result = await followsService.sendFollowRequest(
          request.user!.id,
          body.followeeUsername,
        );
        return reply.code(201).send({ data: result, error: null });
      } catch (err) {
        if (err instanceof FollowError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.patch(
    '/follows/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = patchFollowBodySchema.parse(request.body);
      try {
        const result = await followsService.respondToFollow(request.user!.id, id, body.action);
        return reply.send({ data: result, error: null });
      } catch (err) {
        if (err instanceof FollowError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.delete(
    '/follows/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await followsService.removeFollow(request.user!.id, id);
        return reply.send({ data: { success: true }, error: null });
      } catch (err) {
        if (err instanceof FollowError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.get(
    '/follows/pending',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const result = await followsService.getPending(request.user!.id);
      return reply.send({ data: result, error: null });
    },
  );

  fastify.get(
    '/follows',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const result = await followsService.getAccepted(request.user!.id);
      return reply.send({ data: result, error: null });
    },
  );
};

export default followsRoutes;
