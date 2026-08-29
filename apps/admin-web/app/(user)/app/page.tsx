import Link from 'next/link';
import { Check, Circle as CircleIcon, MapPin, Users, UserPlus, ArrowRight } from 'lucide-react';
import type { Circle, CircleWithMembers, Follow, User } from '@findfam/shared-types';
import { Card, CardContent } from '@/components/ui/card';
import { buttonVariants } from '@/components/ui/button';
import { userApiGet } from '@/lib/api-client';
import { cn } from '@/lib/utils';

export const metadata = { title: 'FindFam' };

/**
 * The first thing a new account sees, and for a while the only thing it has
 * anything to show.
 *
 * The checklist is derived entirely from endpoints that already exist rather
 * than from a stored "onboarding_step" — so it cannot drift out of sync with
 * reality, and un-completing a step (leaving your last circle) correctly
 * un-ticks it.
 */
export default async function AppOverviewPage() {
  const [meResult, circlesResult, pendingResult] = await Promise.all([
    userApiGet<User>('/api/v1/auth/me'),
    userApiGet<Circle[]>('/api/v1/circles'),
    userApiGet<Follow[]>('/api/v1/follows/pending'),
  ]);

  const circles = circlesResult.ok ? circlesResult.data : [];
  const pending = pendingResult.ok ? pendingResult.data : [];
  const username = meResult.ok ? meResult.data.username : null;

  // GET /circles returns no member count, so "is anybody else in here yet?"
  // needs the detail call. Fanned out over what is realistically a handful
  // of circles; if that ever stops being true, the fix is a count on the
  // list endpoint, not a cached onboarding flag here.
  const details = await Promise.all(
    circles.map((circle) => userApiGet<CircleWithMembers>(`/api/v1/circles/${circle.id}`)),
  );
  const hasCompany = details.some((detail) => detail.ok && detail.data.members.length > 1);

  const steps = [
    {
      done: true,
      title: 'Create an account',
      body: 'Done — nobody can find you by searching for your username.',
      href: null,
      cta: null,
    },
    {
      done: circles.length > 0,
      title: 'Create a circle, or join one with a code',
      body: 'A circle is the group you share your location with. Start one, or enter a code somebody sent you.',
      href: '/app/circles',
      cta: 'Go to circles',
    },
    {
      done: hasCompany,
      title: 'Get somebody else in there',
      body: 'Share your circle\u2019s invite code, or add someone you already follow. Then you will see each other move on the map in real time.',
      href: circles.length > 0 ? `/app/circles/${circles[0]!.id}` : '/app/circles',
      cta: 'Invite someone',
    },
  ];

  const allDone = steps.every((step) => step.done);

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {username ? `Welcome back, ${username}` : 'Welcome to FindFam'}
        </h1>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {allDone
            ? 'Everything is set up. Open the map to see where everyone is.'
            : 'A couple of things left before your circle can see each other.'}
        </p>
      </div>

      {pending.length > 0 ? (
        <Card variant="glass" className="border-brand/30">
          <CardContent className="flex items-center justify-between gap-4 p-5">
            <div className="flex items-start gap-3">
              <UserPlus className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
              <div>
                <p className="font-medium">
                  {pending.length === 1
                    ? '1 person wants to follow you'
                    : `${pending.length} people want to follow you`}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  Nothing is shared until you accept.
                </p>
              </div>
            </div>
            <Link href="/app/people" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
              Review
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <ol className="space-y-3">
        {steps.map((step) => (
          <li key={step.title}>
            <Card variant="glass" className={cn(step.done && 'opacity-70')}>
              <CardContent className="flex items-start gap-4 p-5">
                <div
                  className={cn(
                    'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
                    step.done ? 'bg-brand/15 text-brand' : 'border border-border text-muted-foreground',
                  )}
                >
                  {step.done ? <Check className="h-3.5 w-3.5" /> : <CircleIcon className="h-2 w-2 fill-current" />}
                </div>
                <div className="flex-1">
                  <h2 className={cn('font-medium', step.done && 'line-through decoration-1')}>
                    {step.title}
                  </h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{step.body}</p>
                </div>
                {!step.done && step.href ? (
                  <Link
                    href={step.href}
                    className={buttonVariants({ variant: 'outline', size: 'sm' })}
                  >
                    {step.cta}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                ) : null}
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <div className="grid gap-3 sm:grid-cols-2">
        <Link href="/app/map">
          <Card variant="glass" className="h-full">
            <CardContent className="flex items-center gap-3 p-5">
              <MapPin className="h-5 w-5 text-brand" />
              <div>
                <p className="font-medium">Live map</p>
                <p className="text-sm text-muted-foreground">
                  {circles.length === 0
                    ? 'Nothing to show yet'
                    : `${circles.length} ${circles.length === 1 ? 'circle' : 'circles'}`}
                </p>
              </div>
            </CardContent>
          </Card>
        </Link>
        <Link href="/app/circles">
          <Card variant="glass" className="h-full">
            <CardContent className="flex items-center gap-3 p-5">
              <Users className="h-5 w-5 text-brand" />
              <div>
                <p className="font-medium">Circles</p>
                <p className="text-sm text-muted-foreground">Create one or join with a code</p>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      <p className="text-xs text-muted-foreground">
        SOS can only be raised from the FindFam phone app — a browser tab is not the device you are
        carrying when you need it.
      </p>
    </div>
  );
}
