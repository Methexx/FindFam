import admin from 'firebase-admin';
import { env } from '../config/env';
import { findFcmTokenForUser } from '../modules/auth/auth.repository';

export interface PushNotification {
  title: string;
  body: string;
  data?: Record<string, string>;
}

// Lazy init, not module-load-time: FCM_SERVICE_ACCOUNT_JSON is '{}' in the
// test environment (vitest.config.ts) since tests never send a real push —
// initializing eagerly would throw on import for every test file that
// pulls this module in transitively (messages/sos services), long before
// any test actually exercises a push. Deferring until the first real send
// keeps the test suite free of a live Firebase credential.
function ensureInitialized() {
  if (admin.apps.length > 0) return;
  const serviceAccount = JSON.parse(env.FCM_SERVICE_ACCOUNT_JSON);
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}

// Never rethrows — a single failed/expired token, unreachable FCM, or
// missing credentials must never block delivery to other recipients (SOS
// fan-out, chat fan-out).
export async function sendPushToToken(token: string, notification: PushNotification) {
  try {
    ensureInitialized();
    await admin.messaging().send({
      token,
      notification: { title: notification.title, body: notification.body },
      data: notification.data,
    });
  } catch (err) {
    console.warn(`FCM push failed for token ${token}:`, err);
  }
}

export async function sendPushToUser(userId: string, notification: PushNotification) {
  const token = await findFcmTokenForUser(userId);
  if (!token) {
    console.warn(`No FCM token registered for user ${userId}, skipping push`);
    return;
  }
  await sendPushToToken(token, notification);
}
