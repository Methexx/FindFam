import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// The admin_token cookie is httpOnly (see app/api/admin/login/route.ts),
// so client-side JS can't read it directly to open a WS connection for the
// live SOS feed. This route reads it server-side and hands it back over an
// authenticated same-origin fetch — keeps the cookie httpOnly everywhere
// else rather than loosening that for the sake of one WS connection.
export async function GET() {
  const token = cookies().get('admin_token')?.value;
  if (!token) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  return NextResponse.json({ token });
}
