import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, MapPin } from 'lucide-react';
import type { CircleWithMembers, User } from '@findfam/shared-types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { userApiGet } from '@/lib/api-client';
import { InviteCodePanel } from './InviteCodePanel';
import { AddMemberForm, RemoveMemberButton, LeaveOrDeleteButton } from './MemberActions';

export default async function CircleDetailPage({ params }: { params: { id: string } }) {
  const [circleResult, meResult] = await Promise.all([
    userApiGet<CircleWithMembers>(`/api/v1/circles/${params.id}`),
    userApiGet<User>('/api/v1/auth/me'),
  ]);

  if (!circleResult.ok) {
    // The backend answers 404 for a circle you are not in as well as one that
    // does not exist — a private circle's existence is not disclosed to
    // outsiders, and this page must not undo that by saying "forbidden".
    if (circleResult.reason === 'backend-error') notFound();

    return (
      <div className="mx-auto max-w-3xl">
        <Card variant="glass">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {circleResult.reason === 'unauthenticated'
              ? 'Your session has expired. Please sign in again.'
              : 'Unable to load this circle — the request failed.'}
          </CardContent>
        </Card>
      </div>
    );
  }

  const circle = circleResult.data;
  const selfUserId = meResult.ok ? meResult.data.id : null;
  const isOwner = circle.inviteCode !== null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          href="/app/circles"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All circles
        </Link>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{circle.name}</h1>
          <div className="flex items-center gap-2">
            <Link
              href={`/app/map?circle=${circle.id}`}
              className={buttonVariants({ variant: 'outline', size: 'sm' })}
            >
              <MapPin className="h-3.5 w-3.5" />
              View on map
            </Link>
            {selfUserId ? (
              <LeaveOrDeleteButton
                circleId={circle.id}
                circleName={circle.name}
                isOwner={isOwner}
                selfUserId={selfUserId}
              />
            ) : null}
          </div>
        </div>
      </div>

      {isOwner && circle.inviteCode ? (
        <InviteCodePanel circleId={circle.id} inviteCode={circle.inviteCode} />
      ) : null}

      <Card variant="glass">
        <CardContent className="p-5">
          <h2 className="mb-3 font-medium">
            {circle.members.length} {circle.members.length === 1 ? 'member' : 'members'}
          </h2>
          <ul className="divide-y divide-border">
            {circle.members.map((member) => (
              <li key={member.userId} className="flex items-center justify-between gap-3 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{member.username}</span>
                  {member.userId === selfUserId ? <Badge variant="outline">You</Badge> : null}
                  {member.role === 'owner' ? <Badge variant="brand">Owner</Badge> : null}
                </div>
                {isOwner && member.userId !== selfUserId ? (
                  <RemoveMemberButton
                    circleId={circle.id}
                    userId={member.userId}
                    username={member.username}
                  />
                ) : null}
              </li>
            ))}
          </ul>

          {circle.members.length === 1 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              Just you so far. Share the invite code above to get somebody else in.
            </p>
          ) : null}
        </CardContent>
      </Card>

      {isOwner ? <AddMemberForm circleId={circle.id} /> : null}
    </div>
  );
}
