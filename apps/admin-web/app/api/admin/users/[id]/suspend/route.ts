import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Passthrough to the backend, same shape as app/api/admin/login/route.ts —
// keeps the admin token off the client entirely (it's httpOnly) rather than
// exposing it for a client-side fetch, since this is a one-shot action, not
// a persistent connection like the SOS page's WS token exception.
export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  const token = cookies().get('admin_token')?.value;
  if (!token) {
    return NextResponse.json({ data: null, error: 'Not authenticated' }, { status: 401 });
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  const backendRes = await fetch(`${apiBaseUrl}/api/v1/admin/users/${params.id}/suspend`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await backendRes.json();
  return NextResponse.json(body, { status: backendRes.status });
}
