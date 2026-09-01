import Link from 'next/link';
import type { Circle, LocationUpdate, User } from '@findfam/shared-types';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { userApiGet } from '@/lib/api-client';
import { MapView } from './MapView';

export const metadata = { title: 'Map — FindFam' };

export default async function MapPage({
  searchParams,
}: {
  searchParams: { circle?: string };
}) {
  const [circlesResult, meResult, selfLocationResult] = await Promise.all([
    userApiGet<Circle[]>('/api/v1/circles'),
    userApiGet<User>('/api/v1/auth/me'),
    userApiGet<LocationUpdate | null>('/api/v1/locations/latest'),
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

  // `?circle=` comes from the "View on map" link on a circle's detail page.
  // An id that is not one of yours falls back to the first rather than
  // erroring — a stale bookmark should not be a dead end. With zero circles
  // there is nothing to fall back to — the map still renders, just with only
  // the caller's own marker (see initialSelfLocation below).
  const requested = circles.find((circle) => circle.id === searchParams.circle);
  const activeCircle = circles.length > 0 ? (requested ?? circles[0]!) : null;

  const locationsResult = activeCircle
    ? await userApiGet<LocationUpdate[]>(`/api/v1/circles/${activeCircle.id}/locations/latest`)
    : null;

  return (
    // Fills whatever the shell's <main> leaves, rather than the old
    // calc(100vh - 4rem) — that number was only ever right at one breakpoint,
    // and is wrong the moment a top bar and a bottom nav are on screen.
    <div className="flex min-h-0 flex-1 flex-col">
      {circles.length === 0 ? (
        <Alert className="mb-4">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>Join or create a circle to see other people on the map.</span>
            <Link
              href="/app/circles"
              className={buttonVariants({ variant: 'gradient', size: 'sm' })}
            >
              Go to circles
            </Link>
          </AlertDescription>
        </Alert>
      ) : null}
      <MapView
        circles={circles}
        initialCircleId={activeCircle?.id ?? null}
        initialLocations={locationsResult?.ok ? locationsResult.data : []}
        initialSelfLocation={selfLocationResult.ok ? selfLocationResult.data : null}
        selfUserId={meResult.ok ? meResult.data.id : null}
      />
    </div>
  );
}
