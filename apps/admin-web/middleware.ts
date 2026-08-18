import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Decodes the JWT payload's `exp` claim without verifying the signature —
// this is deliberately NOT a security boundary. Real authorization is the
// backend's 401 on every API call plus lib/api-client.ts's redirect; this
// only avoids the more common bad experience of a dashboard rendering with
// an already-expired cookie and every fetch silently failing underneath it.
// Edge middleware can't use Node's Buffer/crypto, hence the manual
// base64url decode instead of a JWT library.
export function isExpired(token: string): boolean {
  const payloadSegment = token.split('.')[1];
  if (!payloadSegment) return true;

  try {
    const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(base64);
    const payload = JSON.parse(json) as { exp?: number };
    if (typeof payload.exp !== 'number') return true;
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
}

export function middleware(request: NextRequest) {
  const token = request.cookies.get('admin_token')?.value;

  if (!token || isExpired(token)) {
    const loginUrl = new URL('/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
