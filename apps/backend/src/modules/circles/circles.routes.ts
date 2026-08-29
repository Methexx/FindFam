import type { FastifyPluginAsync } from 'fastify';
import {
  createCircleBodySchema,
  updateCircleBodySchema,
  addMemberBodySchema,
  joinCircleBodySchema,
} from './circles.schema';
import * as circlesService from './circles.service';
import { CircleError } from './circles.service';
import { rateLimitConfig } from '../../lib/rate-limit-config';

const circlesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/circles',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = createCircleBodySchema.parse(request.body);
      const result = await circlesService.createCircle(request.user!.id, body.name);
      return reply.code(201).send({ data: result, error: null });
    },
  );

  fastify.get(
    '/circles',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const result = await circlesService.listCircles(request.user!.id);
      return reply.send({ data: result, error: null });
    },
  );

  // Rate-limited because an unlimited join endpoint is a code-guessing
  // oracle: 8 characters over a 31-symbol alphabet is only strong against
  // an attacker who can't try millions of them. Same helper and budget as
  // the auth routes.
  fastify.post(
    '/circles/join',
    { preHandler: fastify.authenticate, config: rateLimitConfig(10, '1 minute') },
    async (request, reply) => {
      const body = joinCircleBodySchema.parse(request.body);
      try {
        const result = await circlesService.joinCircleByCode(request.user!.id, body.code);
        return reply.code(201).send({ data: result, error: null });
      } catch (err) {
        if (err instanceof CircleError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.post(
    '/circles/:id/invite-code/rotate',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await circlesService.rotateInviteCode(request.user!.id, id);
        return reply.send({ data: result, error: null });
      } catch (err) {
        if (err instanceof CircleError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.get(
    '/circles/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const result = await circlesService.getCircle(request.user!.id, id);
        return reply.send({ data: result, error: null });
      } catch (err) {
        if (err instanceof CircleError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.patch(
    '/circles/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateCircleBodySchema.parse(request.body);
      try {
        const result = await circlesService.updateCircle(request.user!.id, id, body.name);
        return reply.send({ data: result, error: null });
      } catch (err) {
        if (err instanceof CircleError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.delete(
    '/circles/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        await circlesService.deleteCircle(request.user!.id, id);
        return reply.send({ data: { success: true }, error: null });
      } catch (err) {
        if (err instanceof CircleError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.post(
    '/circles/:id/members',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = addMemberBodySchema.parse(request.body);
      try {
        await circlesService.addMember(request.user!.id, id, body.username);
        return reply.code(201).send({ data: { success: true }, error: null });
      } catch (err) {
        if (err instanceof CircleError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.delete(
    '/circles/:id/members/:userId',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id, userId } = request.params as { id: string; userId: string };
      try {
        await circlesService.removeMember(request.user!.id, id, userId);
        return reply.send({ data: { success: true }, error: null });
      } catch (err) {
        if (err instanceof CircleError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );
};

export default circlesRoutes;
