import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  // Same flags as login's cookies().set(...) — a delete with mismatched
  // flags can silently fail to clear the cookie in some browsers.
  cookies().set('admin_token', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  });

  return NextResponse.json({ success: true });
}
