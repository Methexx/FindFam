import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  API_BASE_URL,
  USER_TOKEN_COOKIE,
  USER_REFRESH_TOKEN_COOKIE,
  refreshAccessToken,
} from '@/lib/user-session';

// `user_token` is httpOnly, so the client can't read it to open a WebSocket.
// This exchanges it server-side for a short-lived (60s), ws-scoped token —
// the same shape as /api/admin/ws-token, and for the same reason: returning
// the session cookie's value to client JS would defeat the point of it being
// httpOnly.
export async function GET() {
  const jar = cookies();
  let token = jar.get(USER_TOKEN_COOKIE)?.value;

  if (!token) {
    // The access token expires every 15 minutes and a long-lived map tab
    // will outlive it. Middleware normally refreshes on navigation, but this
    // route is reached by fetch, not navigation, so it refreshes for itself
    // rather than failing a reconnect that had a perfectly good session
    // behind it. The new token is used in-process only — a route handler
    // could persist it, but middleware writing the same cookie on the next
    // navigation is the single owner of that write.
    const refreshToken = jar.get(USER_REFRESH_TOKEN_COOKIE)?.value;
    if (!refreshToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    const result = await refreshAccessToken(refreshToken);
    if (result.status !== 'refreshed') {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    token = result.accessToken;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/auth/ws-token`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach the server' }, { status: 502 });
  }

  if (!res.ok) {
    return NextResponse.json({ error: 'Could not mint a WS token' }, { status: res.status });
  }

  const body = await res.json();
  return NextResponse.json({ token: body.data.token });
}
