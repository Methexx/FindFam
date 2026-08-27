import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { isExpired, middleware } from '../middleware';

function fakeJwt(payload: Record<string, unknown>): string {
  const encode = (obj: unknown) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url');
  return `${encode({ alg: 'HS256' })}.${encode(payload)}.fakesignature`;
}

const validToken = fakeJwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) + 600 });
const expiredToken = fakeJwt({ sub: 'u1', exp: Math.floor(Date.now() / 1000) - 600 });

function requestFor(path: string, cookies: Record<string, string> = {}): NextRequest {
  const request = new NextRequest(new URL(`http://localhost:3001${path}`));
  for (const [name, value] of Object.entries(cookies)) {
    request.cookies.set(name, value);
  }
  return request;
}

/** NextResponse.next() carries this header; a redirect does not. */
function isPassThrough(response: Response): boolean {
  return response.headers.get('x-middleware-next') === '1';
}

describe('isExpired', () => {
  it('returns true for a token whose exp is in the past', () => {
    expect(isExpired(fakeJwt({ sub: 'admin1', exp: 1000000000 }))).toBe(true);
  });

  it('returns false for a token whose exp is in the future', () => {
    expect(isExpired(fakeJwt({ sub: 'admin1', exp: 9999999999 }))).toBe(false);
  });

  it('returns true when exp is missing from the payload', () => {
    expect(isExpired(fakeJwt({ sub: 'admin1' }))).toBe(true);
  });

  it('returns true for a malformed token with no payload segment', () => {
    expect(isExpired('not-a-jwt')).toBe(true);
  });

  it('returns true for a payload segment that is not valid JSON', () => {
    const badPayload = Buffer.from('not json').toString('base64url');
    expect(isExpired(`header.${badPayload}.sig`)).toBe(true);
  });
});

describe('middleware — admin routes', () => {
  it('redirects to /login when admin_token is missing', async () => {
    const response = await middleware(requestFor('/dashboard/users'));
    expect(response.headers.get('location')).toContain('/login');
  });

  it('redirects to /login when admin_token has expired', async () => {
    const response = await middleware(
      requestFor('/dashboard/users', { admin_token: expiredToken }),
    );
    expect(response.headers.get('location')).toContain('/login');
  });

  it('lets a valid admin_token through', async () => {
    const response = await middleware(
      requestFor('/dashboard/users', { admin_token: validToken }),
    );
    expect(isPassThrough(response)).toBe(true);
  });

  it('does not attempt a refresh for admins, even holding a user refresh token', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const response = await middleware(
      requestFor('/dashboard/users', {
        admin_token: expiredToken,
        user_refresh_token: 'a-refresh-token',
      }),
    );

    expect(fetch).not.toHaveBeenCalled();
    expect(response.headers.get('location')).toContain('/login');
    vi.unstubAllGlobals();
  });
});

describe('middleware — user routes', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lets a valid user_token through without calling refresh', async () => {
    const response = await middleware(requestFor('/app/map', { user_token: validToken }));

    expect(isPassThrough(response)).toBe(true);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('redirects to /login when neither user cookie is present', async () => {
    const response = await middleware(requestFor('/app/map'));

    expect(response.headers.get('location')).toContain('/login');
    expect(fetch).not.toHaveBeenCalled();
  });

  it('refreshes an expired access token and sets the new cookie', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { accessToken: 'fresh-token' }, error: null }), {
        status: 200,
      }),
    );

    const response = await middleware(
      requestFor('/app/map', { user_token: expiredToken, user_refresh_token: 'a-refresh-token' }),
    );

    expect(isPassThrough(response)).toBe(true);
    expect(response.cookies.get('user_token')?.value).toBe('fresh-token');
  });

  it('refreshes when the access token cookie is absent but a refresh token is held', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { accessToken: 'fresh-token' }, error: null }), {
        status: 200,
      }),
    );

    const response = await middleware(
      requestFor('/app/map', { user_refresh_token: 'a-refresh-token' }),
    );

    expect(isPassThrough(response)).toBe(true);
    expect(response.cookies.get('user_token')?.value).toBe('fresh-token');
  });

  it('leaves the non-rotating refresh cookie alone when it refreshes', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { accessToken: 'fresh-token' }, error: null }), {
        status: 200,
      }),
    );

    const response = await middleware(
      requestFor('/app/map', { user_token: expiredToken, user_refresh_token: 'a-refresh-token' }),
    );

    // Refresh tokens do not rotate and refresh() returns only an access
    // token — writing this cookie is how you log everybody out at their
    // first expiry. See docs/06-auth-flow.md.
    expect(response.cookies.get('user_refresh_token')).toBeUndefined();
  });

  it('clears both cookies and redirects when the refresh token is rejected', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: null, error: 'Invalid or expired refresh token' }), {
        status: 401,
      }),
    );

    const response = await middleware(
      requestFor('/app/map', { user_token: expiredToken, user_refresh_token: 'a-dead-token' }),
    );

    expect(response.headers.get('location')).toContain('/login');
    expect(response.cookies.get('user_token')?.value).toBe('');
    expect(response.cookies.get('user_refresh_token')?.value).toBe('');
  });

  it('clears the session when the account has been suspended', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: null, error: 'Account suspended' }), { status: 403 }),
    );

    const response = await middleware(
      requestFor('/app/map', { user_token: expiredToken, user_refresh_token: 'a-refresh-token' }),
    );

    expect(response.headers.get('location')).toContain('/login');
    expect(response.cookies.get('user_refresh_token')?.value).toBe('');
  });

  it('passes through without clearing cookies when the backend is unreachable', async () => {
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));

    const response = await middleware(
      requestFor('/app/map', { user_token: expiredToken, user_refresh_token: 'a-refresh-token' }),
    );

    // An API blip must not sign anybody out — the page renders the
    // "backend request failed" state instead, which is the truth.
    expect(isPassThrough(response)).toBe(true);
    expect(response.cookies.get('user_refresh_token')).toBeUndefined();
  });

  it('passes through without clearing cookies when the backend 5xxs', async () => {
    vi.mocked(fetch).mockResolvedValue(new Response('upstream boom', { status: 503 }));

    const response = await middleware(
      requestFor('/app/map', { user_token: expiredToken, user_refresh_token: 'a-refresh-token' }),
    );

    expect(isPassThrough(response)).toBe(true);
    expect(response.cookies.get('user_refresh_token')).toBeUndefined();
  });
});
