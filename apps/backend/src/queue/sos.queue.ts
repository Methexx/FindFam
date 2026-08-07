import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env';

export interface SosDeliveryJob {
  sosEventId: string;
  userId: string;
}

// BullMQ requires maxRetriesPerRequest: null on any connection it owns.
const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
connection.on('error', (err) => {
  console.error('[sos.queue] redis connection error:', err.message);
});

export const sosQueue = new Queue<SosDeliveryJob>('sos-delivery', { connection });

// 5 attempts, exponential backoff starting at 2s (2s/4s/8s/16s/32s) —
// guaranteed-delivery for emergency contacts without blocking anything
// else, per docs/05-realtime-channels.md.
export function enqueueSosDelivery(job: SosDeliveryJob) {
  return sosQueue.add('deliver', job, {
    attempts: 5,
    backoff: { type: 'exponential', delay: 2000 },
  });
}
