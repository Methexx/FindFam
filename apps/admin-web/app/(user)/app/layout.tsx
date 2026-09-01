import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { User } from '@findfam/shared-types';
import { userApiGet } from '@/lib/api-client';
import { isProfileComplete, PROFILE_SETUP_SKIPPED_COOKIE } from '@/lib/profile-completion';
import { AppShellClient } from './AppShellClient';

/**
 * A Server Component so it can run the profile-completion gate, which needs
 * the current user. The nav lives in AppShellClient because it carries icon
 * *components*, which cannot cross the server/client boundary.
 *
 * `redirect` rather than rendering the setup screen in place of `children`:
 * `children` is already-rendered content by the time it arrives here, so
 * swapping it out still runs every page's data fetching and ships its markup
 * in the payload — the dashboard would be sitting in the HTML underneath the
 * gate. Redirecting stops the page rendering at all.
 *
 * /setup lives outside this layout precisely so this cannot loop.
 *
 * Deliberately not in middleware.ts: that runs on the edge and only decodes
 * the JWT's `exp` claim today. Enforcing there would mean a GET /auth/me on
 * every single navigation.
 */
export default async function UserAppLayout({ children }: { children: React.ReactNode }) {
  const meResult = await userApiGet<User>('/api/v1/auth/me');
  const skipped = cookies().get(PROFILE_SETUP_SKIPPED_COOKIE)?.value === '1';

  // A failed /auth/me is not a reason to gate: an expired session is already
  // middleware's job, and a backend blip must not strand somebody on a setup
  // screen they cannot submit. Fall through to the app in that case.
  if (meResult.ok && !isProfileComplete(meResult.data) && !skipped) {
    redirect('/setup');
  }

  return <AppShellClient>{children}</AppShellClient>;
}
