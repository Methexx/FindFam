import Link from 'next/link';
import { MapPin } from 'lucide-react';
import type { Circle, LocationUpdate, User } from '@findfam/shared-types';
import { Card, CardContent } from '@/components/ui/card';
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
      <div className="mx-auto max-w-lg">
        <Card variant="glass">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <MapPin className="h-6 w-6 text-muted-foreground" />
            <p className="font-medium">There is nobody to show yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              The map shows the people in your circles. Create a circle, or join one with a code.
            </p>
            <Link href="/app/circles" className={buttonVariants({ variant: 'gradient' })}>
              Go to circles
            </Link>
          </CardContent>
        </Card>
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
    <div className="h-[calc(100vh-4rem)]">
      <MapView
        circles={circles}
        initialCircleId={activeCircle.id}
        initialLocations={locationsResult.ok ? locationsResult.data : []}
        selfUserId={meResult.ok ? meResult.data.id : null}
      />
    </div>
  );
}
