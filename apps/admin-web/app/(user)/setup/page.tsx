import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import type { User } from '@findfam/shared-types';
import { userApiGet } from '@/lib/api-client';
import { isProfileComplete, PROFILE_SETUP_SKIPPED_COOKIE } from '@/lib/profile-completion';
import { CompleteProfileGate } from './CompleteProfileGate';

export const metadata = { title: 'Finish setting up — FindFam' };

/**
 * Deliberately outside `(user)/app`, so it does not inherit that layout —
 * which is what lets the layout redirect here without looping, and means
 * the gate renders with no app shell or nav to click past.
 */
export default async function SetupPage() {
  const meResult = await userApiGet<User>('/api/v1/auth/me');

  if (!meResult.ok) {
    redirect('/login');
  }

  // Nothing left to collect (or already skipped) — don't strand anybody on
  // a setup screen they have no reason to see.
  const skipped = cookies().get(PROFILE_SETUP_SKIPPED_COOKIE)?.value === '1';
  if (isProfileComplete(meResult.data) || skipped) {
    redirect('/app');
  }

  return <CompleteProfileGate user={meResult.data} />;
}
