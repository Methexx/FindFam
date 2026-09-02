import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { PROFILE_SETUP_SKIPPED_COOKIE } from '@/lib/profile-completion';

/**
 * Dismisses the profile-completion gate for this browser session only.
 *
 * No `maxAge`/`expires`, deliberately: that makes it a session cookie, so it
 * dies with the browser and the gate prompts again next sign-in. A durable
 * "skipped forever" flag would need to live on the user record, and the
 * point of the gate is to keep asking until the profile is actually filled.
 */
export async function POST() {
  cookies().set(PROFILE_SETUP_SKIPPED_COOKIE, '1', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });

  return NextResponse.json({ success: true });
}
