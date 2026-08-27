import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { Circle, LocationUpdate, User } from '@findfam/shared-types';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { buttonVariants } from '@/components/ui/button';
import { userApiGet } from '@/lib/api-client';
import { MapView } from './MapView';

export const metadata = { title: 'Map — FindFam' };

export default async function MapPage({
  searchParams,
}: {
  searchParams: { circle?: string };
}) {
  const [circlesResult, meResult] = await Promise.all([
    userApiGet<Circle[]>('/api/v1/circles'),
    userApiGet<User>('/api/v1/auth/me'),
  ]);

  if (!circlesResult.ok) {
    return (
      <Card variant="glass">
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          {circlesResult.reason === 'unauthenticated'
            ? 'Your session has expired. Please sign in again.'
            : 'Unable to load your circles — the request failed.'}
        </CardContent>
      </Card>
    );
  }

  const circles = circlesResult.data;

  if (circles.length === 0) {
    return (
      <div className="mx-auto w-full max-w-lg">
        <EmptyState
          icon={MapPin}
          title="There is nobody to show yet"
          body="The map shows the people in your circles. Create a circle, or join one with a code."
          action={
            <Link href="/app/circles" className={buttonVariants({ variant: 'gradient' })}>
              Go to circles
            </Link>
          }
        />
      </div>
    );
  }

  // `?circle=` comes from the "View on map" link on a circle's detail page.
  // An id that is not one of yours falls back to the first rather than
  // erroring — a stale bookmark should not be a dead end.
  const requested = circles.find((circle) => circle.id === searchParams.circle);
  const activeCircle = requested ?? circles[0]!;

  const locationsResult = await userApiGet<LocationUpdate[]>(
    `/api/v1/circles/${activeCircle.id}/locations/latest`,
  );

  return (
    // Fills whatever the shell's <main> leaves, rather than the old
    // calc(100vh - 4rem) — that number was only ever right at one breakpoint,
    // and is wrong the moment a top bar and a bottom nav are on screen.
    <div className="flex min-h-0 flex-1 flex-col">
      <MapView
        circles={circles}
        initialCircleId={activeCircle.id}
        initialLocations={locationsResult.ok ? locationsResult.data : []}
        selfUserId={meResult.ok ? meResult.data.id : null}
      />
    </div>
  );
}
