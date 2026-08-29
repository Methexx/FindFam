import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_BASE_URL, USER_REFRESH_TOKEN_COOKIE } from '@/lib/user-session';
import { clearUserSessionCookies } from '@/lib/set-user-session';

export async function POST() {
  const refreshToken = cookies().get(USER_REFRESH_TOKEN_COOKIE)?.value;

  // Tell the backend first so the refresh token is deleted server-side, not
  // merely forgotten by this browser — a refresh token that still exists in
  // the database is one a stolen copy can keep using. Best-effort: if the
  // call fails the cookies are still cleared below, because leaving somebody
  // apparently signed in because logout errored is the worse outcome.
  if (refreshToken) {
    try {
      await fetch(`${API_BASE_URL}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        cache: 'no-store',
      });
    } catch {
      // Ignored on purpose — see above.
    }
  }

  clearUserSessionCookies();
  return NextResponse.json({ success: true });
}
