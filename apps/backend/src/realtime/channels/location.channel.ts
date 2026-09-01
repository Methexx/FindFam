import { z } from 'zod';
import * as locationsService from '../../modules/locations/locations.service';
import { LocationError } from '../../modules/locations/locations.service';

const locationUpdateSchema = z.object({
  type: z.literal('location:update'),
  payload: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    speed: z.number().nullable().optional(),
    batteryLevel: z.number().int().min(0).max(100).nullable().optional(),
    platform: z.enum(['web', 'mobile']).optional(),
  }),
});

export interface LocationChannelResult {
  ok: boolean;
  error?: string;
}

/**
 * Handles a parsed `location:update` WS message for one authenticated
 * connection: validates the payload, applies the same rate limit as the
 * REST fallback, writes to `locations`, and publishes the broadcast to
 * every circle the sender belongs to. Shared write/broadcast path with the
 * REST endpoint via locationsService.submitLocation — this file only owns
 * the WS-message-shaped validation on top of it.
 */
export async function handleLocationUpdate(
  userId: string,
  rawMessage: unknown,
): Promise<LocationChannelResult> {
  const parsed = locationUpdateSchema.safeParse(rawMessage);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid location:update payload' };
  }

  try {
    await locationsService.submitLocation({
      userId,
      lat: parsed.data.payload.lat,
      lng: parsed.data.payload.lng,
      speed: parsed.data.payload.speed,
      batteryLevel: parsed.data.payload.batteryLevel,
      platform: parsed.data.payload.platform,
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof LocationError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
}
