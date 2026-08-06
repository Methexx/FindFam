import { z } from 'zod';

export const createCircleBodySchema = z.object({
  name: z.string().min(1).max(100),
});
export type CreateCircleBody = z.infer<typeof createCircleBodySchema>;

export const updateCircleBodySchema = z.object({
  name: z.string().min(1).max(100),
});
export type UpdateCircleBody = z.infer<typeof updateCircleBodySchema>;

export const addMemberBodySchema = z.object({
  username: z.string().min(1),
});
export type AddMemberBody = z.infer<typeof addMemberBodySchema>;
