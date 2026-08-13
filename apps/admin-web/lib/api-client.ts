import { cookies } from 'next/headers';

export type AdminApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; reason: 'unauthenticated' | 'fetch-failed' | 'backend-error'; message?: string };

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

/**
 * Server-side GET against the backend admin API, using the httpOnly
 * admin_token cookie. Distinguishes "no session", "backend rejected the
 * request", and "network/fetch itself failed" instead of the
 * `if (!res.ok) return []`-style silent empty state the dashboard pages
 * used before this, which rendered "No X found." indistinguishably from
 * an actual empty result.
 */
export async function adminApiGet<T>(path: string): Promise<AdminApiResult<T>> {
  const token = cookies().get('admin_token')?.value;
  if (!token) {
    return { ok: false, reason: 'unauthenticated' };
  }

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
