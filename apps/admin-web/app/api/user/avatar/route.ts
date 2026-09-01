import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  API_BASE_URL,
  USER_TOKEN_COOKIE,
  USER_REFRESH_TOKEN_COOKIE,
  refreshAccessToken,
} from '@/lib/user-session';

/**
 * A dedicated route rather than a case in the generic `[...path]` proxy:
 * that proxy is JSON-text end to end (reads the body via `request.text()`,
 * always forwards `Content-Type: application/json`), which would corrupt a
 * multipart file upload. Re-posting the same `FormData` object the request
 * already parsed lets `fetch` set the correct multipart boundary itself,
 * rather than us reconstructing the raw bytes.
 */
export async function POST(request: Request) {
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

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ data: null, error: 'Invalid upload' }, { status: 400 });
  }

  const target = `${API_BASE_URL}/api/v1/auth/me/avatar`;
  const send = (bearer: string) =>
    fetch(target, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}` },
      body: formData,
    });

  let res: Response;
  try {
    res = await send(token);
    if (res.status === 401 && refreshToken) {
      const refreshed = await refreshAccessToken(refreshToken);
      if (refreshed.status === 'refreshed') {
        res = await send(refreshed.accessToken);
      }
    }
  } catch {
    return NextResponse.json({ data: null, error: 'Could not reach the server' }, { status: 502 });
  }

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: { 'Content-Type': res.headers.get('Content-Type') ?? 'application/json' },
  });
}
