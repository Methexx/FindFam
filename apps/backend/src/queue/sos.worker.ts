import { Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { env } from '../config/env';
import type { SosDeliveryJob } from './sos.queue';
import * as sosRepository from '../modules/sos/sos.repository';
import * as authRepository from '../modules/auth/auth.repository';
import * as emergencyContactsRepository from '../modules/emergency-contacts/emergency-contacts.repository';
import { sendPushToUser } from '../lib/fcm';

const connection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null });
connection.on('error', (err) => {
  console.error('[sos.worker] redis connection error:', err.message);
});

export const sosWorker = new Worker<SosDeliveryJob>(
  'sos-delivery',
  async (job) => {
    const event = await sosRepository.findEventById(job.data.sosEventId);
    if (!event) return; // event was removed/raced with cleanup — nothing to notify for

    const triggeringUser = await authRepository.findUserById(job.data.userId);
    const contacts = await emergencyContactsRepository.listContactsForUser(job.data.userId);

    for (const contact of contacts) {
      await sendPushToUser(contact.contact_user_id, {
        title: 'SOS Alert',
        body: `${triggeringUser?.username ?? 'A contact'} needs help`,
        data: { type: 'sos', sosEventId: event.id },
      });
    }
  },
  { connection },
);

sosWorker.on('failed', (job, err) => {
  console.error(`[sos.worker] job ${job?.id} failed:`, err.message);
});
