import type { FastifyPluginAsync } from 'fastify';
import { addContactBodySchema, updateContactBodySchema } from './emergency-contacts.schema';
import * as emergencyContactsService from './emergency-contacts.service';
import { EmergencyContactError } from './emergency-contacts.service';

const emergencyContactsRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/emergency-contacts',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const body = addContactBodySchema.parse(request.body);
      try {
        const result = await emergencyContactsService.addContact(request.user!.id, body);
        return reply.code(201).send({ data: result, error: null });
      } catch (err) {
        if (err instanceof EmergencyContactError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.get(
    '/emergency-contacts',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const result = await emergencyContactsService.listContacts(request.user!.id);
      return reply.send({ data: result, error: null });
    },
  );

  fastify.patch(
    '/emergency-contacts/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateContactBodySchema.parse(request.body);
      try {
        const result = await emergencyContactsService.updateContactPriority(
          request.user!.id,
          id,
          body.priority,
        );
        return reply.send({ data: result, error: null });
      } catch (err) {
        if (err instanceof EmergencyContactError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.delete(
    '/emergency-contacts/:id',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      await emergencyContactsService.removeContact(request.user!.id, id);
      return reply.send({ data: { success: true }, error: null });
    },
  );
};

export default emergencyContactsRoutes;
