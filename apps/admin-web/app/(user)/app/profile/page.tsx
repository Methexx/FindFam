import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import type { User } from '@findfam/shared-types';
import { Card, CardContent } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { buttonVariants } from '@/components/ui/button';
import { userApiGet } from '@/lib/api-client';
import {
  AvatarUploader,
  ProfileDetailsForm,
  ChangePasswordForm,
  DeactivateAccountButton,
} from './ProfileActions';

export const metadata = { title: 'Profile — FindFam' };

export default async function ProfilePage() {
  const meResult = await userApiGet<User>('/api/v1/auth/me');

  if (!meResult.ok) {
    return (
      <Card variant="glass">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {meResult.reason === 'unauthenticated'
            ? 'Your session has expired. Please sign in again.'
            : 'Unable to load your profile — the request failed.'}
        </CardContent>
      </Card>
    );
  }

  const user = meResult.data;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <PageHeader title="Profile" description="Your account details, as seen by people you share with." />

      <Card variant="glass">
        <CardContent className="space-y-6 p-5">
          <AvatarUploader avatarUrl={user.avatarUrl} name={user.displayName ?? user.username} />
          <ProfileDetailsForm
            username={user.username}
            displayName={user.displayName}
            phone={user.phone}
          />
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardContent className="p-5">
          <h2 className="mb-3 font-medium">Change password</h2>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card variant="glass">
        <CardContent className="flex items-center justify-between gap-4 p-5">
          <div>
            <h2 className="font-medium">Emergency contacts</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Who gets notified when you trigger an SOS.
            </p>
          </div>
          <Link
            href="/app/profile/emergency-contacts"
            className={buttonVariants({ variant: 'outline', size: 'sm' })}
          >
            Manage
          </Link>
        </CardContent>
      </Card>

      <Card variant="glass" className="border-destructive/30">
        <CardContent className="p-5">
          <div className="mb-3 flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            <h2 className="font-medium">Deactivate account</h2>
          </div>
          <p className="mb-4 text-sm text-muted-foreground">
            Signs you out everywhere and blocks login until an admin reactivates it. Circles you
            own, your messages, and your location history are not deleted.
          </p>
          <DeactivateAccountButton />
        </CardContent>
      </Card>
    </div>
  );
}
