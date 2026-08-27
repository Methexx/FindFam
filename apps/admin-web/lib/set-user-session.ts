import { cookies } from 'next/headers';
import {
  API_BASE_URL,
  USER_TOKEN_COOKIE,
  USER_REFRESH_TOKEN_COOKIE,
  USER_TOKEN_MAX_AGE_SECONDS,
  USER_REFRESH_TOKEN_MAX_AGE_SECONDS,
  sessionCookieOptions,
} from './user-session';

/**
 * The Node-runtime half of the user session: everything that needs
 * `next/headers`. Kept out of `lib/user-session.ts` because that module is
 * imported by edge middleware, which cannot use `cookies()`.
 */

export function setUserSessionCookies(accessToken: string, refreshToken: string): void {
  const jar = cookies();
  jar.set(USER_TOKEN_COOKIE, accessToken, sessionCookieOptions(USER_TOKEN_MAX_AGE_SECONDS));
  jar.set(
    USER_REFRESH_TOKEN_COOKIE,
    refreshToken,
    sessionCookieOptions(USER_REFRESH_TOKEN_MAX_AGE_SECONDS),
  );
}

export function clearUserSessionCookies(): void {
  const jar = cookies();
  // maxAge 0 with otherwise identical flags — a delete whose flags don't
  // match the ones the cookie was set with can silently fail.
  jar.set(USER_TOKEN_COOKIE, '', sessionCookieOptions(0));
  jar.set(USER_REFRESH_TOKEN_COOKIE, '', sessionCookieOptions(0));
}

export interface AuthProxyResult {
  ok: boolean;
  status: number;
  error?: string;
}

/**
 * Shared body of `/api/auth/register` and `/api/auth/login`: both post
 * credentials to the backend and, on success, land the returned token pair
 * in the two httpOnly cookies. The browser never holds either in JS.
 */
export async function authenticateAndSetSession(
  backendPath: string,
  body: unknown,
): Promise<AuthProxyResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1${backendPath}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 502, error: 'Could not reach the server' };
  }

  let payload: { data?: { tokens?: { accessToken?: string; refreshToken?: string } }; error?: string };
  try {
    payload = await res.json();
  } catch {
    return { ok: false, status: 502, error: 'The server sent an unreadable response' };
  }

  if (!res.ok) {
    // Surfaced verbatim: the backend owns the wording of "Username already
    // taken" / "Account suspended", and restating those rules here is how
    // two copies of them drift apart.
    return { ok: false, status: res.status, error: payload.error ?? 'Authentication failed' };
  }

  const accessToken = payload.data?.tokens?.accessToken;
  const refreshToken = payload.data?.tokens?.refreshToken;
  if (typeof accessToken !== 'string' || typeof refreshToken !== 'string') {
    return { ok: false, status: 502, error: 'The server did not return a session' };
  }

  setUserSessionCookies(accessToken, refreshToken);
  return { ok: true, status: res.status };
}
