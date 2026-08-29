import { NextResponse } from 'next/server';
import { authenticateAndSetSession } from '@/lib/set-user-session';

// The user half of the login form. `/login` tries this first and falls back
// to `/api/admin/login`; the two hit different backend endpoints, different
// tables and different signing secrets, and only the form is shared. See
// docs/06-auth-flow.md on why that isolation is the point.
export async function POST(request: Request) {
  const body = await request.json();
  const result = await authenticateAndSetSession('/auth/login', body);

  if (!result.ok) {
    return NextResponse.json({ success: false, error: result.error }, { status: result.status });
  }

  return NextResponse.json({ success: true });
}
