import Link from 'next/link';
import { UserPlus, Camera, ShieldAlert } from 'lucide-react';
import type { User } from '@findfam/shared-types';
import { Card, CardContent } from '@/components/ui/card';
import { GlowBackdrop } from '@/components/ui/glow-backdrop';
import { AvatarUploader } from '../app/profile/ProfileActions';
import { CompleteProfileForm, SkipSetupButton } from './CompleteProfileActions';

/**
 * Shown in place of the app shell until a new account has a display name
 * and a phone number.
 *
 * Only those two block. A photo is offered but never required — uploads
 * 503 until Supabase Storage is configured, so requiring one would lock
 * every new user out. An emergency contact cannot be required at all:
 * the backend rejects any contact you do not already mutually follow, and
 * a fresh account follows nobody, so it is signposted as a later step
 * instead.
 */
export function CompleteProfileGate({ user }: { user: User }) {
  return (
    <div className="relative flex min-h-screen items-start justify-center overflow-hidden p-6">
      <GlowBackdrop />
      <div className="w-full max-w-lg space-y-5 py-8">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Finish setting up</h1>
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            A name and a phone number, so the people you share with know who they are looking
            at — and so an SOS has a number to fall back on.
          </p>
        </div>

        <Card variant="glass">
          <CardContent className="space-y-5 p-5">
            <div className="flex items-center gap-3">
              <UserPlus className="h-4 w-4 shrink-0 text-brand" />
              <h2 className="font-medium">Your details</h2>
            </div>
            <CompleteProfileForm
              username={user.username}
              displayName={user.displayName}
              phone={user.phone}
            />
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <Camera className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <h2 className="font-medium">Photo</h2>
                <p className="text-sm text-muted-foreground">Optional — you can add one later.</p>
              </div>
            </div>
            <AvatarUploader
              avatarUrl={user.avatarUrl}
              name={user.displayName ?? user.username}
            />
          </CardContent>
        </Card>

        <Card variant="glass">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <ShieldAlert className="h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <h2 className="font-medium">Emergency contacts</h2>
                <p className="text-sm text-muted-foreground">
                  Comes after you have added people — a contact has to be someone you already
                  follow each other with.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-between gap-4">
          <SkipSetupButton />
          <Link href="/app/people" className="text-sm text-muted-foreground underline underline-offset-2">
            Find people first
          </Link>
        </div>
      </div>
    </div>
  );
}
