import { NextResponse } from 'next/server';
import { authenticateAndSetSession } from '@/lib/set-user-session';

// Registration returns the same `{ user, tokens }` shape as login, so a new
// account is signed in immediately rather than being bounced to the login
// form to retype the password it just chose.
export async function POST(request: Request) {
  const body = await request.json();
  const result = await authenticateAndSetSession('/auth/register', body);

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
