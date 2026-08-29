import { cookies } from 'next/headers';
import {
  API_BASE_URL,
  ADMIN_TOKEN_COOKIE,
  USER_TOKEN_COOKIE,
  USER_REFRESH_TOKEN_COOKIE,
  refreshAccessToken,
} from './user-session';

export type AdminApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'unauthenticated' | 'fetch-failed' | 'backend-error'; message?: string };

/** The user surface uses the same three-way result; only the caller differs. */
export type UserApiResult<T> = AdminApiResult<T>;

async function get<T>(path: string, token: string): Promise<AdminApiResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    return { ok: false, reason: 'fetch-failed' };
  }

  if (!res.ok) {
    if (res.status === 401) {
      return { ok: false, reason: 'unauthenticated' };
    }
    let message: string | undefined;
    try {
      const body = await res.json();
      message = typeof body?.error === 'string' ? body.error : undefined;
    } catch {
      // Non-JSON error body — fall through with no message.
    }
    return { ok: false, reason: 'backend-error', message };
  }

  const body = await res.json();
  return { ok: true, data: body.data as T };
}

/**
 * Server-side GET against the backend admin API, using the httpOnly
 * admin_token cookie. Distinguishes "no session", "backend rejected the
 * request", and "network/fetch itself failed" instead of the
 * `if (!res.ok) return []`-style silent empty state the dashboard pages
 * used before this, which rendered "No X found." indistinguishably from
 * an actual empty result.
 */
export async function adminApiGet<T>(path: string): Promise<AdminApiResult<T>> {
  const token = cookies().get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) {
    return { ok: false, reason: 'unauthenticated' };
  }
  return get<T>(path, token);
}

/**
 * Server-side GET against the backend user API.
 *
 * On a 401 this refreshes once and retries with the new access token held in
 * a local variable — and then deliberately stops there. It does **not**
 * persist the refreshed token, because a Server Component cannot set
 * cookies; `middleware.ts` owns that write and will do it on the next
 * navigation. So this is the in-render safety net for a token that expired
 * between middleware running and this fetch, not the refresh loop itself.
 */
export async function userApiGet<T>(path: string): Promise<UserApiResult<T>> {
  const jar = cookies();
  const token = jar.get(USER_TOKEN_COOKIE)?.value;

  if (token) {
    const result = await get<T>(path, token);
    if (result.ok || result.reason !== 'unauthenticated') {
      return result;
    }
  }

  const refreshToken = jar.get(USER_REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return { ok: false, reason: 'unauthenticated' };
  }

  const refreshed = await refreshAccessToken(refreshToken);
  if (refreshed.status === 'unavailable') {
    return { ok: false, reason: 'fetch-failed' };
  }
  if (refreshed.status === 'rejected') {
    return { ok: false, reason: 'unauthenticated' };
  }

  return get<T>(path, refreshed.accessToken);
}
