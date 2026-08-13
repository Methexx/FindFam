import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCookieGet = vi.fn();
vi.mock('next/headers', () => ({
  cookies: () => ({ get: mockCookieGet }),
}));

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
      new Response(JSON.stringify({ data: null, error: 'Something broke' }), { status: 500 }),
    );
    const { adminApiGet } = await import('../../lib/api-client');

    const result = await adminApiGet('/api/v1/admin/users');

    expect(result).toEqual({ ok: false, reason: 'backend-error', message: 'Something broke' });
  });

  it('returns ok with the unwrapped data on success', async () => {
    mockCookieGet.mockReturnValue({ value: 'a-token' });
    vi.mocked(fetch).mockResolvedValue(
      new Response(JSON.stringify({ data: { users: [] }, error: null }), { status: 200 }),
    );
    const { adminApiGet } = await import('../../lib/api-client');

    const result = await adminApiGet('/api/v1/admin/users');

    expect(result).toEqual({ ok: true, data: { users: [] } });
  });
});
