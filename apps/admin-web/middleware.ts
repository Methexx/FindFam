import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import {
  ADMIN_TOKEN_COOKIE,
  USER_TOKEN_COOKIE,
  USER_REFRESH_TOKEN_COOKIE,
  USER_TOKEN_MAX_AGE_SECONDS,
  sessionCookieOptions,
  refreshAccessToken,
} from '@/lib/user-session';

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

function redirectToLogin(request: NextRequest): NextResponse {
  return NextResponse.redirect(new URL('/login', request.url));
}

// The admin session is one 8-hour token that is allowed to simply lapse —
// there is no admin refresh token to lapse against. Unchanged from before
// the user surface existed.
function handleAdminRoute(request: NextRequest): NextResponse {
  const token = request.cookies.get(ADMIN_TOKEN_COOKIE)?.value;

  if (!token || isExpired(token)) {
    return redirectToLogin(request);
  }

  return NextResponse.next();
}

/**
 * The user session's refresh loop lives here, and it has to: a Next Server
 * Component can read cookies but cannot set them, so middleware is the only
 * place a refreshed access token can actually be persisted.
 *
 * A user access token lasts 15 minutes against a 7-day refresh token. Doing
 * what the admin route does — expire and bounce to /login — would sign every
 * user out four times an hour.
 */
async function handleUserRoute(request: NextRequest): Promise<NextResponse> {
  const accessToken = request.cookies.get(USER_TOKEN_COOKIE)?.value;
  if (accessToken && !isExpired(accessToken)) {
    return NextResponse.next();
  }

  const refreshToken = request.cookies.get(USER_REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return redirectToLogin(request);
  }

  const result = await refreshAccessToken(refreshToken);

  if (result.status === 'rejected') {
    // The refresh token is genuinely dead — expired, revoked, or the account
    // was suspended. Clear both cookies so the next request doesn't retry a
    // token that will never work again.
    const response = redirectToLogin(request);
    response.cookies.set(USER_TOKEN_COOKIE, '', sessionCookieOptions(0));
    response.cookies.set(USER_REFRESH_TOKEN_COOKIE, '', sessionCookieOptions(0));
    return response;
  }

  if (result.status === 'unavailable') {
    // The backend was unreachable or 5xx'd. That says nothing about whether
    // the session is valid, so the cookies stay and the request goes
    // through — the page will render api-client's "backend request failed"
    // state, which is the truth. Signing somebody out because the API
    // blipped would be a worse lie.
    return NextResponse.next();
  }

  // Mutating request.cookies before constructing the response is what makes
  // the new token visible to the Server Component rendering *this* request.
  // Setting it only on the response would refresh the cookie in the browser
  // but still render this page with the expired one — so every first
  // navigation after an expiry would fail before the next one succeeded.
  request.cookies.set(USER_TOKEN_COOKIE, result.accessToken);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(
    USER_TOKEN_COOKIE,
    result.accessToken,
    sessionCookieOptions(USER_TOKEN_MAX_AGE_SECONDS),
  );
  // user_refresh_token is deliberately NOT touched: refresh tokens do not
  // rotate and `refresh()` returns only an access token. See
  // docs/06-auth-flow.md.
  return response;
}

export function middleware(request: NextRequest): NextResponse | Promise<NextResponse> {
  if (request.nextUrl.pathname.startsWith('/dashboard')) {
    return handleAdminRoute(request);
  }
  return handleUserRoute(request);
}

// /setup is the profile-completion gate. It sits outside /app (so the app
// layout can redirect to it without looping) but is just as
// authentication-gated, so it needs the same token-refresh treatment.
export const config = {
  matcher: ['/app/:path*', '/setup', '/dashboard/:path*'],
};
