import { Users } from 'lucide-react';
import type { Follow, User } from '@findfam/shared-types';
import { Card, CardContent } from '@/components/ui/card';
import { InlineEmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { userApiGet } from '@/lib/api-client';
import {
  SendFollowRequestForm,
  RespondToFollowButtons,
  RemoveFollowButton,
} from './FollowActions';

export const metadata = { title: 'People — FindFam' };

/**
 * Follows exist because being added to a circle by somebody else is not
 * consent on its own — `addMember` refuses unless the two people already
 * follow each other. This page is how that prerequisite gets met.
 */
export default async function PeoplePage() {
  const [meResult, pendingResult, acceptedResult] = await Promise.all([
    userApiGet<User>('/api/v1/auth/me'),
    userApiGet<Follow[]>('/api/v1/follows/pending'),
    userApiGet<Follow[]>('/api/v1/follows'),
  ]);

  const selfUserId = meResult.ok ? meResult.data.id : null;
  const pending = pendingResult.ok ? pendingResult.data : [];
  const accepted = acceptedResult.ok ? acceptedResult.data : [];

  // GET /follows is bidirectional, so "who is this row about" depends on
  // which end the caller is on.
  const otherPersonIn = (follow: Follow): string => {
    const isFollower = follow.followerId === selfUserId;
    const name = isFollower ? follow.followeeUsername : follow.followerUsername;
    // Falls back to a short id rather than splashing a full 36-character
    // UUID across the UI, matching MemberLocation.displayName on mobile.
    return name ?? `Member ${(isFollower ? follow.followeeId : follow.followerId).slice(0, 4)}`;
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="People"
        description="Following someone is what lets you add them to a circle. It shares nothing on its own."
      />

      {pending.length > 0 ? (
        <Card variant="glass" className="border-brand/30">
          <CardContent className="p-5">
            <h2 className="mb-3 font-medium">
              {pending.length === 1 ? '1 follow request' : `${pending.length} follow requests`}
            </h2>
            <ul className="divide-y divide-border">
              {pending.map((follow) => (
                <li key={follow.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="truncate font-medium">{otherPersonIn(follow)}</span>
                  <RespondToFollowButtons followId={follow.id} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <SendFollowRequestForm />

      <Card variant="glass">
        <CardContent className="p-5">
          <h2 className="mb-3 font-medium">Following</h2>
          {accepted.length === 0 ? (
            <InlineEmptyState
              icon={Users}
              body="Nobody yet. Send a request above, or share a circle invite code instead — that does not need a follow."
            />
          ) : (
            <ul className="divide-y divide-border">
              {accepted.map((follow) => (
                <li key={follow.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="truncate font-medium">{otherPersonIn(follow)}</span>
                  <RemoveFollowButton followId={follow.id} />
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
