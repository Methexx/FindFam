import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// Passthrough to the backend, mirrors the suspend route.
export async function PATCH(_request: Request, { params }: { params: { id: string } }) {
  const token = cookies().get('admin_token')?.value;
  if (!token) {
    return NextResponse.json({ data: null, error: 'Not authenticated' }, { status: 401 });
  }

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  const backendRes = await fetch(`${apiBaseUrl}/api/v1/admin/users/${params.id}/unsuspend`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
  });

  const body = await backendRes.json();
  return NextResponse.json(body, { status: backendRes.status });
}
