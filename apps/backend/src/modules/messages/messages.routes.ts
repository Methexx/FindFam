import type { FastifyPluginAsync } from 'fastify';
import { sendMessageBodySchema, listMessagesQuerySchema } from './messages.schema';
import * as messagesService from './messages.service';
import { MessagesError } from './messages.service';
import { rateLimitConfig } from '../../lib/rate-limit-config';

const messagesRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/circles/:id/messages',
    { preHandler: fastify.authenticate, config: rateLimitConfig(60, '1 minute') },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = sendMessageBodySchema.parse(request.body);
      try {
        const result = await messagesService.sendMessage(request.user!.id, id, body.content);
        return reply.code(201).send({ data: result, error: null });
      } catch (err) {
        if (err instanceof MessagesError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.get(
    '/circles/:id/messages',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const query = listMessagesQuerySchema.parse(request.query);
      try {
        const result = await messagesService.listMessages(request.user!.id, id, query);
        return reply.send({ data: result, error: null });
      } catch (err) {
        if (err instanceof MessagesError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );
};

export default messagesRoutes;
