import { z } from 'zod';

export const addContactBodySchema = z.object({
  username: z.string().min(1),
  phone: z.string().min(1).optional(),
  priority: z.number().int().min(1).optional(),
});
export type AddContactBody = z.infer<typeof addContactBodySchema>;

export const updateContactBodySchema = z.object({
  priority: z.number().int().min(1),
});
export type UpdateContactBody = z.infer<typeof updateContactBodySchema>;
