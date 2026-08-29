import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { API_BASE_URL, ADMIN_TOKEN_COOKIE } from '@/lib/user-session';

// Re-reads the active SOS list for the live feed's reconnect reconcile.
// Events raised while the socket was down were never delivered and the
// gateway has no replay, so coming back without this leaves the feed looking
// healthy while missing exactly the events that happened during the outage.
export async function GET() {
  const token = cookies().get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ data: null, error: 'Not authenticated' }, { status: 401 });
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}/api/v1/admin/sos/active`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ data: null, error: 'Could not reach the server' }, { status: 502 });
  }

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}
