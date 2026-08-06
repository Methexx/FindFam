// TODO: Sprint 1 — augment FastifyRequest with `user` (auth) once the auth plugin is implemented
import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {}
}
