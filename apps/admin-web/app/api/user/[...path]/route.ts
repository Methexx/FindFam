import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  API_BASE_URL,
  USER_TOKEN_COOKIE,
  USER_REFRESH_TOKEN_COOKIE,
  refreshAccessToken,
} from '@/lib/user-session';

/**
 * The write half of the user BFF.
 *
 * Server Components read (via `userApiGet`) but cannot mutate, and client
 * components cannot attach the bearer token because the cookie holding it is
 * httpOnly. Every mutation therefore needs a route handler. This is one
 * handler rather than the eight near-identical files that would otherwise
 * exist — they could only differ by drifting.
 *
 * The allowlist is not what makes this safe: every path below is already
 * authorized server-side against the caller's own token, so the blast radius
 * is exactly "what this user can already do". It is here so the surface is
 * written down, and so this can never be pointed at `/admin/*` — where the
 * admin secret would reject it anyway, but "rejected by a second mechanism"
 * is a worse story than "never reachable".
 */
const ALLOWED_PREFIXES = ['circles', 'follows', 'locations', 'auth/me'];

function isAllowed(path: string): boolean {
  return ALLOWED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

async function proxy(request: Request, pathSegments: string[]): Promise<NextResponse> {
  const path = pathSegments.join('/');
  if (!isAllowed(path)) {
    return NextResponse.json({ data: null, error: 'Not found' }, { status: 404 });
  }

  const jar = cookies();
  let token = jar.get(USER_TOKEN_COOKIE)?.value;
  const refreshToken = jar.get(USER_REFRESH_TOKEN_COOKIE)?.value;

  if (!token) {
    if (!refreshToken) {
      return NextResponse.json({ data: null, error: 'Not authenticated' }, { status: 401 });
    }
    const refreshed = await refreshAccessToken(refreshToken);
    if (refreshed.status !== 'refreshed') {
      return NextResponse.json({ data: null, error: 'Not authenticated' }, { status: 401 });
    }
    token = refreshed.accessToken;
  }

  // Read the body once — a Request body is a stream and cannot be replayed
  // on the retry below, so it has to be buffered before the first attempt.
  // Normalised to undefined when empty: DELETE and the parameterless POSTs
  // (invite-code rotate) send no body, and forwarding a zero-length string
  // is not the same thing as forwarding nothing.
  const rawBody = request.method === 'GET' ? '' : await request.text();
  const body = rawBody.length > 0 ? rawBody : undefined;
  const search = new URL(request.url).search;
  const target = `${API_BASE_URL}/api/v1/${path}${search}`;

  const send = (bearer: string) =>
    fetch(target, {
      method: request.method,
      headers: {
        Authorization: `Bearer ${bearer}`,
        ...(body ? { 'Content-Type': 'application/json' } : {}),
      },
      body,
      cache: 'no-store',
    });

  let res: Response;
  try {
    res = await send(token);

    // The access token can expire between middleware running and this call.
    // Refresh once and replay; the new token is used in-process only, since
    // middleware owns persisting it (see lib/api-client.ts).
    if (res.status === 401 && refreshToken) {
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed.status === 'refreshed') {
        res = await send(refreshed.accessToken);
      }
    }
  } catch {
    return NextResponse.json({ data: null, error: 'Could not reach the server' }, { status: 502 });
  }

  // Passed through verbatim, status included: the backend owns the wording
  // of "Invalid invite code", "You are already in this circle" and the
  // mutual-follow 403, and the UI shows those directly.
  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}

type RouteContext = { params: { path: string[] } };

export function GET(request: Request, { params }: RouteContext) {
  return proxy(request, params.path);
}

export function POST(request: Request, { params }: RouteContext) {
  return proxy(request, params.path);
}

export function PATCH(request: Request, { params }: RouteContext) {
  return proxy(request, params.path);
}

export function DELETE(request: Request, { params }: RouteContext) {
  return proxy(request, params.path);
}
