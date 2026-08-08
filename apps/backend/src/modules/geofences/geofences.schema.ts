import { z } from 'zod';

export const createGeofenceBodySchema = z.object({
  name: z.string().min(1).max(100),
  center: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
  radiusMeters: z.number().int().positive(),
});
export type CreateGeofenceBody = z.infer<typeof createGeofenceBodySchema>;
