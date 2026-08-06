import { env } from '../config/env';

/**
 * Per-route rate limit config. Disabled in the test environment so
 * integration tests that register/log in many users in one suite run
 * aren't throttled by brute-force protection meant for real traffic.
 */
export function rateLimitConfig(max: number, timeWindow: string) {
  if (env.NODE_ENV === 'test') {
    return undefined;
  }
  return { rateLimit: { max, timeWindow } };
}
