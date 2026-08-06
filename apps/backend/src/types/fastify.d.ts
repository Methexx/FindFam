import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    user?: { id: string; username: string };
    admin?: { id: string; email: string };
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    authenticateAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}
