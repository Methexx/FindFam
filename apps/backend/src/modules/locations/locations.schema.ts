import { z } from 'zod';

export const postLocationBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().nullable().optional(),
  batteryLevel: z.number().int().min(0).max(100).nullable().optional(),
  recordedAt: z.string().datetime().optional(),
});
export type PostLocationBody = z.infer<typeof postLocationBodySchema>;

export const updateSharingStatusBodySchema = z.object({
  isSharing: z.boolean(),
});
export type UpdateSharingStatusBody = z.infer<typeof updateSharingStatusBodySchema>;
