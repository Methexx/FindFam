import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => ({ get: mockCookieGet }),
}));

/** Backs mockCookieGet with a name -> value map, the way a real jar reads. */
function withCookies(jar: Record<string, string>) {
  mockCookieGet.mockImplementation((name: string) =>
    jar[name] === undefined ? undefined : { value: jar[name] },
  );
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), { status });
}

describe('adminApiGet', () => {
  beforeEach(() => {
    mockCookieGet.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns unauthenticated when the admin_token cookie is missing', async () => {
    mockCookieGet.mockReturnValue(undefined);
    const { adminApiGet } = await import('../../lib/api-client');

    const result = await adminApiGet('/api/v1/admin/users');

    expect(result).toEqual({ ok: false, reason: 'unauthenticated' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns fetch-failed when the network request itself throws', async () => {
    mockCookieGet.mockReturnValue({ value: 'a-token' });
    vi.mocked(fetch).mockRejectedValue(new Error('network down'));
    const { adminApiGet } = await import('../../lib/api-client');

    const result = await adminApiGet('/api/v1/admin/users');

    expect(result).toEqual({ ok: false, reason: 'fetch-failed' });
  });

  it('returns backend-error with the message when the backend responds non-ok', async () => {
    mockCookieGet.mockReturnValue({ value: 'a-token' });
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ data: null, error: 'Something broke' }, 500),
    );
    const { adminApiGet } = await import('../../lib/api-client');

    const result = await adminApiGet('/api/v1/admin/users');

    expect(result).toEqual({ ok: false, reason: 'backend-error', message: 'Something broke' });
  });

  it('reports an expired admin token as unauthenticated, not backend-error', async () => {
    mockCookieGet.mockReturnValue({ value: 'a-stale-token' });
    vi.mocked(fetch).mockResolvedValue(
      jsonResponse({ data: null, error: 'Invalid or expired token' }, 401),
    );
    const { adminApiGet } = await import('../../lib/api-client');

    const result = await adminApiGet('/api/v1/admin/users');

    // The dashboard pages already render "Your session has expired" for
    // 'unauthenticated'; a 401 is exactly that, and used to fall through to
    // the generic backend-error copy instead.
    expect(result).toEqual({ ok: false, reason: 'unauthenticated' });
  });

  it('returns ok with the unwrapped data on success', async () => {
    mockCookieGet.mockReturnValue({ value: 'a-token' });
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: { users: [] }, error: null }, 200));
    const { adminApiGet } = await import('../../lib/api-client');

    const result = await adminApiGet('/api/v1/admin/users');

    expect(result).toEqual({ ok: true, data: { users: [] } });
  });
});

describe('userApiGet', () => {
  beforeEach(() => {
    mockCookieGet.mockReset();
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns unauthenticated when neither user cookie is present', async () => {
    withCookies({});
    const { userApiGet } = await import('../../lib/api-client');

    const result = await userApiGet('/api/v1/circles');

    expect(result).toEqual({ ok: false, reason: 'unauthenticated' });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('returns data on the first try without refreshing', async () => {
    withCookies({ user_token: 'good', user_refresh_token: 'r' });
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: [{ id: 'c1' }], error: null }, 200));
    const { userApiGet } = await import('../../lib/api-client');

    const result = await userApiGet('/api/v1/circles');

    expect(result).toEqual({ ok: true, data: [{ id: 'c1' }] });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('refreshes once and retries when the access token has expired', async () => {
    withCookies({ user_token: 'stale', user_refresh_token: 'r' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ data: null, error: 'Invalid or expired token' }, 401))
      .mockResolvedValueOnce(jsonResponse({ data: { accessToken: 'fresh' }, error: null }, 200))
      .mockResolvedValueOnce(jsonResponse({ data: [{ id: 'c1' }], error: null }, 200));
    const { userApiGet } = await import('../../lib/api-client');

    const result = await userApiGet('/api/v1/circles');

    expect(result).toEqual({ ok: true, data: [{ id: 'c1' }] });
    expect(fetch).toHaveBeenCalledTimes(3);

    // The retry must carry the refreshed token, not the stale one.
    const retryInit = vi.mocked(fetch).mock.calls[2]?.[1] as RequestInit;
    expect((retryInit.headers as Record<string, string>).Authorization).toBe('Bearer fresh');
  });

  it('does not retry more than once', async () => {
    withCookies({ user_token: 'stale', user_refresh_token: 'r' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ data: null, error: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ data: { accessToken: 'fresh' }, error: null }, 200))
      .mockResolvedValueOnce(jsonResponse({ data: null, error: 'expired' }, 401));
    const { userApiGet } = await import('../../lib/api-client');

    const result = await userApiGet('/api/v1/circles');

    expect(result).toEqual({ ok: false, reason: 'unauthenticated' });
    expect(fetch).toHaveBeenCalledTimes(3);
  });

  it('refreshes when the access token cookie is gone but the refresh token is held', async () => {
    withCookies({ user_refresh_token: 'r' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ data: { accessToken: 'fresh' }, error: null }, 200))
      .mockResolvedValueOnce(jsonResponse({ data: [], error: null }, 200));
    const { userApiGet } = await import('../../lib/api-client');

    const result = await userApiGet('/api/v1/circles');

    expect(result).toEqual({ ok: true, data: [] });
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('reports unauthenticated when the refresh token is rejected', async () => {
    withCookies({ user_token: 'stale', user_refresh_token: 'dead' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ data: null, error: 'expired' }, 401))
      .mockResolvedValueOnce(jsonResponse({ data: null, error: 'Invalid refresh token' }, 401));
    const { userApiGet } = await import('../../lib/api-client');

    const result = await userApiGet('/api/v1/circles');

    expect(result).toEqual({ ok: false, reason: 'unauthenticated' });
  });

  it('reports fetch-failed, not unauthenticated, when the refresh call cannot reach the API', async () => {
    withCookies({ user_token: 'stale', user_refresh_token: 'r' });
    vi.mocked(fetch)
      .mockResolvedValueOnce(jsonResponse({ data: null, error: 'expired' }, 401))
      .mockRejectedValueOnce(new Error('network down'));
    const { userApiGet } = await import('../../lib/api-client');

    const result = await userApiGet('/api/v1/circles');

    // 'unauthenticated' renders "your session has expired" and invites a
    // re-login that would not have been necessary — the API was just down.
    expect(result).toEqual({ ok: false, reason: 'fetch-failed' });
  });

  it('does not refresh on a non-401 backend error', async () => {
    withCookies({ user_token: 'good', user_refresh_token: 'r' });
    vi.mocked(fetch).mockResolvedValue(jsonResponse({ data: null, error: 'Circle not found' }, 404));
    const { userApiGet } = await import('../../lib/api-client');

    const result = await userApiGet('/api/v1/circles/nope');

    expect(result).toEqual({ ok: false, reason: 'backend-error', message: 'Circle not found' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
