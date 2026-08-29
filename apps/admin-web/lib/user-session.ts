/**
 * Cookie names, lifetimes and flags for the *user* session, plus the one
 * API base URL both sessions share.
 *
 * Deliberately free of `next/headers` and of any Node-only API: this module
 * is imported by `middleware.ts`, which runs on the edge runtime, as well as
 * by the route handlers and `lib/api-client.ts`. Anything that needs
 * `cookies()` belongs in the caller, not here.
 */

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

export const USER_TOKEN_COOKIE = 'user_token';
export const USER_REFRESH_TOKEN_COOKIE = 'user_refresh_token';
export const ADMIN_TOKEN_COOKIE = 'admin_token';

/** Matches ACCESS_TOKEN_TTL in the backend's auth.service.ts. */
export const USER_TOKEN_MAX_AGE_SECONDS = 15 * 60;
/** Matches REFRESH_TOKEN_TTL_MS in the backend's auth.service.ts. */
export const USER_REFRESH_TOKEN_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export interface SessionCookieOptions {
  httpOnly: true;
  secure: boolean;
  sameSite: 'lax';
  maxAge: number;
  path: string;
}

/**
 * One place for the flags, because a cookie deleted with flags that don't
 * match the ones it was set with can silently fail to clear in some
 * browsers — the same hazard `app/api/admin/logout/route.ts` calls out.
 */
export function sessionCookieOptions(maxAgeSeconds: number): SessionCookieOptions {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAgeSeconds,
    path: '/',
  };
}

/**
 * Three outcomes, not two, because "the backend rejected this refresh token"
 * and "the backend was unreachable" call for opposite responses: the first
 * means the session is genuinely over and the cookies should be cleared, the
 * second means try again shortly. Collapsing them into a nullable token
 * would sign users out every time the API blipped.
 */
export type RefreshResult =
  | { status: 'refreshed'; accessToken: string }
  | { status: 'rejected' }
  | { status: 'unavailable' };

/**
 * Exchanges a refresh token for a fresh access token.
 *
 * Yields only an access token because that is genuinely all the server gives
 * back. Refresh tokens do **not** rotate (see docs/06-auth-flow.md):
 * `POST /auth/refresh` responds `{ accessToken }` and leaves the refresh
 * record alone. Callers must replace `user_token` and leave
 * `user_refresh_token` untouched — writing a rotation-shaped client against
 * a non-rotating server logs every user out at their first token expiry.
 */
export async function refreshAccessToken(refreshToken: string): Promise<RefreshResult> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
      cache: 'no-store',
    });
  } catch {
    return { status: 'unavailable' };
  }

  // 401 for an invalid/expired/revoked token, 403 for a suspended account.
  // Both end the session; a 5xx does not.
  if (res.status >= 500) return { status: 'unavailable' };
  if (!res.ok) return { status: 'rejected' };

  try {
    const body = await res.json();
    const accessToken = body?.data?.accessToken;
    if (typeof accessToken !== 'string') return { status: 'rejected' };
    return { status: 'refreshed', accessToken };
  } catch {
    return { status: 'unavailable' };
  }
}
