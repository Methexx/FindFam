import { z } from 'zod';

export const registerBodySchema = z.object({
  username: z.string().min(3).max(32),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(8),
});
export type RegisterBody = z.infer<typeof registerBodySchema>;

export const loginBodySchema = z.object({
  usernameOrEmail: z.string().min(1),
  password: z.string().min(1),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const refreshBodySchema = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshBody = z.infer<typeof refreshBodySchema>;

export const patchMeBodySchema = z.object({
  avatarUrl: z.string().optional(),
  phone: z.string().optional(),
});
export type PatchMeBody = z.infer<typeof patchMeBodySchema>;

export const fcmTokenBodySchema = z.object({
  fcmToken: z.string().min(1),
});
export type FcmTokenBody = z.infer<typeof fcmTokenBodySchema>;
