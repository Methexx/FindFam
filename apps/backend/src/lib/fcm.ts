import admin from 'firebase-admin';
import { env } from '../config/env';
import { findFcmTokenForUser, clearFcmTokenByValue } from '../modules/auth/auth.repository';
import { captureException } from '../plugins/sentry';

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
// fan-out, chat fan-out). But it must not fail *silently* either: this was
// the exact gap that let a broken send path survive two sprints unnoticed
// (see docs/09-sprint-timeline.md Sprint 4), so every failure is reported.
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
    captureException(err);

    const code = (err as { code?: string } | undefined)?.code;
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
      // This token will never deliver again — clear it rather than let it
      // fail the same way on every future push to whoever holds it.
      await clearFcmTokenByValue(token).catch((clearErr) => captureException(clearErr));
    }
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
