import { z } from 'zod';

export const sendFollowBodySchema = z.object({
  followeeUsername: z.string().min(1),
});
export type SendFollowBody = z.infer<typeof sendFollowBodySchema>;

export const patchFollowBodySchema = z.object({
  action: z.enum(['accept', 'reject']),
});
export type PatchFollowBody = z.infer<typeof patchFollowBodySchema>;
