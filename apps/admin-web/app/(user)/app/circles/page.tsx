import Link from 'next/link';
import { ChevronRight, Users } from 'lucide-react';
import type { Circle } from '@findfam/shared-types';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import { PageHeader } from '@/components/ui/page-header';
import { userApiGet } from '@/lib/api-client';
import { CircleActions } from './CircleActions';

export const metadata = { title: 'Circles — FindFam' };

export default async function CirclesPage() {
  const result = await userApiGet<Circle[]>('/api/v1/circles');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Circles"
        description="A circle is the group you share your location with."
        actions={<CircleActions />}
      />

      {!result.ok ? (
        <Card variant="glass">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            {result.reason === 'unauthenticated'
              ? 'Your session has expired. Please sign in again.'
              : (result.message ?? 'Unable to load your circles — the request failed.')}
          </CardContent>
        </Card>
      ) : result.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="You are not in a circle yet"
          body="Create one and share the invite code, or enter a code somebody already sent you."
        />
      ) : (
        <ul className="space-y-3">
          {result.data.map((circle) => (
            <li key={circle.id}>
              <Link href={`/app/circles/${circle.id}`}>
                <Card variant="glass">
                  <CardContent className="flex items-center justify-between gap-4 p-5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="truncate font-medium">{circle.name}</p>
                        {/* inviteCode is only ever populated for the owner,
                            so its presence is the ownership signal. */}
                        {circle.inviteCode ? <Badge variant="brand">Owner</Badge> : null}
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Created {new Date(circle.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
