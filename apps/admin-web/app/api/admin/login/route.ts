import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

const ADMIN_TOKEN_MAX_AGE_SECONDS = 8 * 60 * 60;

export async function POST(request: Request) {
  const body = await request.json();

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  const backendRes = await fetch(`${apiBaseUrl}/api/v1/admin/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const backendBody = await backendRes.json();

  if (!backendRes.ok) {
    return NextResponse.json(
      { success: false, error: backendBody.error ?? 'Login failed' },
      { status: backendRes.status },
    );
  }

  cookies().set('admin_token', backendBody.data.tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: ADMIN_TOKEN_MAX_AGE_SECONDS,
    path: '/',
  });

  return NextResponse.json({ success: true });
}
