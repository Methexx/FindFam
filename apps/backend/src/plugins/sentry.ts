import * as Sentry from '@sentry/node';
import { env } from '../config/env';

// Skipped in tests so test runs never report against a real Sentry project
// (mirrors the test-env skip in lib/rate-limit-config.ts).
export function initSentry(): void {
  if (env.NODE_ENV === 'test') return;
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });
}

export function captureException(err: unknown): void {
  if (env.NODE_ENV === 'test') return;
  Sentry.captureException(err);
}
