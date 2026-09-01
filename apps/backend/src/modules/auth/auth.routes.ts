import type { FastifyPluginAsync } from 'fastify';
import {
  registerBodySchema,
  loginBodySchema,
  refreshBodySchema,
  patchMeBodySchema,
  fcmTokenBodySchema,
  changePasswordBodySchema,
} from './auth.schema';
import * as authService from './auth.service';
import { AuthError } from './auth.service';
import { AvatarUploadError } from '../../lib/supabase-storage';
import { rateLimitConfig } from '../../lib/rate-limit-config';

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    '/auth/register',
    { config: rateLimitConfig(5, '1 minute') },
    async (request, reply) => {
      const body = registerBodySchema.parse(request.body);
      try {
        const result = await authService.register(body);
        return reply.code(201).send({ data: result, error: null });
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.post(
    '/auth/login',
    { config: rateLimitConfig(10, '1 minute') },
    async (request, reply) => {
      const body = loginBodySchema.parse(request.body);
      try {
        const result = await authService.login(body);
        return reply.send({ data: result, error: null });
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.post('/auth/refresh', async (request, reply) => {
    const body = refreshBodySchema.parse(request.body);
    try {
      const result = await authService.refresh(body.refreshToken);
      return reply.send({ data: result, error: null });
    } catch (err) {
      if (err instanceof AuthError) {
        return reply.code(err.statusCode).send({ data: null, error: err.message });
      }
      throw err;
    }
  });

  fastify.post('/auth/logout', async (request, reply) => {
    const body = refreshBodySchema.parse(request.body);
    await authService.logout(body.refreshToken);
    return reply.send({ data: { success: true }, error: null });
  });

  fastify.get(
    '/auth/me',
    { preHandler: fastify.authenticate },
    async (request, reply) => {
      const user = await authService.getMe(request.user!.id);
      return reply.send({ data: user, error: null });
    },
  );

  fastify.post(
    '/auth/ws-token',
    { preHandler: fastify.authenticate, config: rateLimitConfig(30, '1 minute') },
    async (request, reply) => {
      const result = await authService.mintWsToken(request.user!.id, request.user!.username);
      return reply.send({ data: result, error: null });
    },
  );

  fastify.patch(
    '/auth/me',
    { preHandler: fastify.authenticate, config: rateLimitConfig(30, '1 minute') },
    async (request, reply) => {
      const body = patchMeBodySchema.parse(request.body);
      try {
        const user = await authService.updateMe(request.user!.id, body);
        return reply.send({ data: user, error: null });
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  // Tighter budget than the other authenticated auth.routes.ts writes —
  // this is a sensitive auth action, matching /auth/login's rate limit
  // rather than the routine-profile-edit one above.
  fastify.patch(
    '/auth/me/password',
    { preHandler: fastify.authenticate, config: rateLimitConfig(5, '1 minute') },
    async (request, reply) => {
      const body = changePasswordBodySchema.parse(request.body);
      try {
        await authService.changePassword(request.user!.id, body);
        return reply.send({ data: { success: true }, error: null });
      } catch (err) {
        if (err instanceof AuthError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.post(
    '/auth/me/avatar',
    { preHandler: fastify.authenticate, config: rateLimitConfig(30, '1 minute') },
    async (request, reply) => {
      const file = await request.file();
      if (!file) {
        return reply.code(400).send({ data: null, error: 'No file uploaded' });
      }
      // fastify/multipart already caps this at 5MB (app.ts) and would set
      // file.file.truncated rather than throw — checked explicitly so an
      // oversized upload gets a clear 413, not a silently truncated image.
      if (file.file.truncated) {
        return reply.code(413).send({ data: null, error: 'Image must be under 5MB' });
      }

      const buffer = await file.toBuffer();
      try {
        const user = await authService.updateAvatar(request.user!.id, file.mimetype, buffer);
        return reply.send({ data: user, error: null });
      } catch (err) {
        if (err instanceof AvatarUploadError) {
          return reply.code(err.statusCode).send({ data: null, error: err.message });
        }
        throw err;
      }
    },
  );

  fastify.post(
    '/auth/me/deactivate',
    { preHandler: fastify.authenticate, config: rateLimitConfig(5, '1 minute') },
    async (request, reply) => {
      await authService.deactivateAccount(request.user!.id);
      return reply.send({ data: { success: true }, error: null });
    },
  );

  // Separate from PATCH /auth/me deliberately: logout must be able to
  // unambiguously delete the token (DELETE has exactly one meaning, unlike
  // teaching PATCH to distinguish "absent" from "explicitly null"), token
  // refresh is a platform-channel lifecycle event unrelated to profile
  // edits, and both fire far more often than a profile edit so they get
  // their own rate-limit budget.
  fastify.put(
    '/auth/fcm-token',
    { preHandler: fastify.authenticate, config: rateLimitConfig(30, '1 minute') },
    async (request, reply) => {
      const body = fcmTokenBodySchema.parse(request.body);
      await authService.registerFcmToken(request.user!.id, body.fcmToken);
      return reply.send({ data: { success: true }, error: null });
    },
  );

  fastify.delete(
    '/auth/fcm-token',
    { preHandler: fastify.authenticate, config: rateLimitConfig(30, '1 minute') },
    async (request, reply) => {
      await authService.deleteFcmToken(request.user!.id);
      return reply.send({ data: { success: true }, error: null });
    },
  );
};

export default authRoutes;
