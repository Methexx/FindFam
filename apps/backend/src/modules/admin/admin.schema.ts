import { z } from 'zod';

export const adminLoginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type AdminLoginBody = z.infer<typeof adminLoginBodySchema>;

export const listUsersQuerySchema = z.object({
  cursor: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListUsersQuery = z.infer<typeof listUsersQuerySchema>;
