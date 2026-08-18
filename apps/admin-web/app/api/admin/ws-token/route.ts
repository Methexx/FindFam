import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// The admin_token cookie is httpOnly (see app/api/admin/login/route.ts),
// so client-side JS can't read it directly to open a WS connection for the
// live SOS feed. Previously this route returned that cookie's value
// verbatim — handing the full 8h session credential to client JS defeated
// the point of it being httpOnly. Instead, exchange it server-side for a
// short-lived (60s), ws-scoped token (POST /admin/auth/ws-token, aud: 'ws')
// that the WS gateway accepts but no REST route does.
export async function GET() {
  const token = cookies().get('admin_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  const backendRes = await fetch(`${apiBaseUrl}/api/v1/admin/auth/ws-token`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!backendRes.ok) {
    return NextResponse.json({ error: 'Could not mint a WS token' }, { status: backendRes.status });
  }

  const body = await backendRes.json();
  return NextResponse.json({ token: body.data.token });
}
