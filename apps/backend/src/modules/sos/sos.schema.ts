import { z } from 'zod';

export const triggerSosBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export type TriggerSosBody = z.infer<typeof triggerSosBodySchema>;
