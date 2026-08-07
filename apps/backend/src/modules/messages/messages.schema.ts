import { z } from 'zod';

export const sendMessageBodySchema = z.object({
  content: z.string().min(1).max(2000),
});
export type SendMessageBody = z.infer<typeof sendMessageBodySchema>;

export const listMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export type ListMessagesQuery = z.infer<typeof listMessagesQuerySchema>;
