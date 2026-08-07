import { z } from 'zod';
import * as sosService from '../../modules/sos/sos.service';

const sosTriggerSchema = z.object({
  type: z.literal('sos:trigger'),
  payload: z.object({
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
  }),
});

export interface SosChannelResult {
  ok: boolean;
  error?: string;
}

/**
 * Handles a parsed `sos:trigger` WS message. Delegates entirely to
 * sosService.triggerSos — the same function the REST route calls — which
 * already owns dedup, the synchronous circle+admin broadcast, and the
 * BullMQ enqueue. This file is purely the WS-message-shape adapter; no
 * broadcast logic belongs here.
 */
export async function handleSosTrigger(
  userId: string,
  rawMessage: unknown,
): Promise<SosChannelResult> {
  const parsed = sosTriggerSchema.safeParse(rawMessage);
  if (!parsed.success) {
    return { ok: false, error: 'Invalid sos:trigger payload' };
  }

  await sosService.triggerSos(userId, parsed.data.payload);
  return { ok: true };
}
