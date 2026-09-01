import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ADMIN_TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60;

export async function POST(request: Request) {
  const body = await request.json();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';

  let backendRes: Response;
  try {
    backendRes = await fetch(`${apiBaseUrl}/api/v1/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Could not reach the server' },
      { status: 502 },
    );
  }

  let backendBody: { data?: { tokens?: { accessToken?: string } }; error?: string };
  try {
    backendBody = await backendRes.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'The server sent an unreadable response' },
      { status: 502 },
    );
  }

  if (!backendRes.ok) {
    return NextResponse.json(
      { success: false, error: backendBody.error ?? 'Login failed' },
      { status: backendRes.status },
    );
  }

  const accessToken = backendBody.data?.tokens?.accessToken;
  if (typeof accessToken !== 'string') {
    return NextResponse.json(
      { success: false, error: 'The server did not return a session' },
      { status: 502 },
    );
  }

  cookies().set('admin_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_TOKEN_MAX_AGE_SECONDS,
    path: '/',
  });

  return NextResponse.json({ success: true });
}
