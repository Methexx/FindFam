'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Wifi, WifiOff, Loader2, MapPinOff } from 'lucide-react';
import type { Circle, LocationUpdate } from '@findfam/shared-types';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { InlineEmptyState } from '@/components/ui/empty-state';
import { useFindFamSocket, type WsMessage } from '@/lib/ws-client';
import { isStale, timeAgo, displayNameFor } from '@/lib/map-config';
import { ShareLocationToggle } from '@/components/map/share-location-toggle';
import { cn } from '@/lib/utils';

// Leaflet reads `window` at module scope, so the map cannot be server
// rendered at all — not a preference, a hard requirement.
const CircleMap = dynamic(() => import('@/components/map/circle-map'), {
  ssr: false,
  loading: () => <Skeleton className="h-full w-full rounded-lg" />,
});

interface LocationBroadcast extends LocationUpdate {
  circleId: string;
}

export function MapView({
  circles,
  initialCircleId,
  initialLocations,
  initialSelfLocation,
  selfUserId,
}: {
  circles: Circle[];
  initialCircleId: string | null;
  initialLocations: LocationUpdate[];
  initialSelfLocation: LocationUpdate | null;
  selfUserId: string | null;
}) {
  const [circleId, setCircleId] = useState<string | null>(initialCircleId);
  const [locationsByCircle, setLocationsByCircle] = useState<Record<string, LocationUpdate[]>>(
    initialCircleId ? { [initialCircleId]: initialLocations } : {},
  );
  // Not scoped to any circle — a self-only fix (no circle joined yet, or a
  // fresh browser GPS position that hasn't round-tripped through a circle
  // broadcast) has no home in locationsByCircle.
  const [selfLocation, setSelfLocation] = useState<LocationUpdate | null>(initialSelfLocation);

  const locations = useMemo(() => {
    const base = circleId ? (locationsByCircle[circleId] ?? []) : [];
    if (!selfUserId || !selfLocation) return base;
    // Replace, don't append: if the active circle's roster already carries
    // an entry for us, the live/local fix is the freshest source of truth.
    return [...base.filter((location) => location.userId !== selfUserId), selfLocation];
  }, [locationsByCircle, circleId, selfLocation, selfUserId]);

  /** Re-reads the authoritative list for one circle from REST. */
  const loadCircle = useCallback(async (id: string) => {
    const res = await fetch(`/api/user/circles/${id}/locations/latest`);
    if (!res.ok) return;
    const body = await res.json();
    setLocationsByCircle((previous) => ({ ...previous, [id]: body.data ?? [] }));
  }, []);

  const handleMessage = useCallback((message: WsMessage) => {
    if (message.type !== 'location:broadcast') return;

    const payload = message.payload as LocationBroadcast;
    setLocationsByCircle((previous) => {
      const existing = previous[payload.circleId] ?? [];
      // One pin per member: replace that member's position rather than
      // appending, or a moving member accumulates a trail of stale markers.
      const next = [
        ...existing.filter((location) => location.userId !== payload.userId),
        payload,
      ];
      return { ...previous, [payload.circleId]: next };
    });
  }, []);

  // Anything broadcast while the socket was down is gone — the gateway has no
  // replay. Re-reading every circle we hold is the reconcile mobile's
  // `onReconnected` hook does for the same reason.
  const handleReconnected = useCallback(() => {
    for (const circle of circles) void loadCircle(circle.id);
  }, [circles, loadCircle]);

  const { status, send } = useFindFamSocket({
    onMessage: handleMessage,
    onReconnected: handleReconnected,
  });

  // Switching to a circle whose positions have not been fetched yet.
  useEffect(() => {
    if (circleId && locationsByCircle[circleId] === undefined) void loadCircle(circleId);
  }, [circleId, locationsByCircle, loadCircle]);

  const activeCircle = circles.find((circle) => circle.id === circleId);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Map</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {activeCircle ? `Everyone in ${activeCircle.name}, live.` : 'Live positions.'}
          </p>
        </div>
        <ConnectionBadge status={status} />
      </div>

      {circles.length > 1 ? (
        <Tabs value={circleId ?? undefined} onValueChange={setCircleId}>
          <TabsList>
            {circles.map((circle) => (
              <TabsTrigger key={circle.id} value={circle.id}>
                {circle.name}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      ) : null}

      <ShareLocationToggle
        send={send}
        onPosition={
          selfUserId
            ? (fix) =>
                setSelfLocation({
                  userId: selfUserId,
                  username: null,
                  lat: fix.lat,
                  lng: fix.lng,
                  speed: fix.speed,
                  batteryLevel: null,
                  recordedAt: fix.recordedAt,
                  platform: 'web',
                })
            : undefined
        }
      />

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="min-h-[24rem] overflow-hidden rounded-lg border border-glass-border">
          <CircleMap circleId={circleId} locations={locations} selfUserId={selfUserId} />
        </div>

        <Card variant="glass" className="min-h-0 overflow-y-auto">
          <CardContent className="p-4">
            <h2 className="mb-2 text-sm font-medium">
              {locations.length} {locations.length === 1 ? 'position' : 'positions'}
            </h2>
            {locations.length === 0 ? (
              <InlineEmptyState
                icon={MapPinOff}
                body={
                  activeCircle
                    ? 'Nobody in this circle has shared a position yet. Start sharing above, or open the phone app.'
                    : 'Nobody has shared a position yet. Start sharing above, or open the phone app.'
                }
              />
            ) : (
              <ul className="divide-y divide-border">
                {locations.map((location) => {
                  const stale = isStale(location.recordedAt);
                  const self = location.userId === selfUserId;
                  return (
                    <li key={location.userId} className="py-2.5">
                      <p className={cn('text-sm font-medium', stale && 'text-muted-foreground')}>
                        {self ? 'You' : displayNameFor(location.userId, location.username)}
                      </p>
                      <p
                        className={cn(
                          'text-xs',
                          stale ? 'font-medium text-amber-400' : 'text-muted-foreground',
                        )}
                      >
                        {stale ? 'Last seen ' : 'Updated '}
                        {timeAgo(location.recordedAt)}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function ConnectionBadge({ status }: { status: 'connecting' | 'open' | 'offline' }) {
  if (status === 'open') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Wifi className="h-3.5 w-3.5 text-emerald-400" />
        Live
      </span>
    );
  }

  if (status === 'connecting') {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Connecting…
      </span>
    );
  }

  // Says "reconnecting", not "offline" — the client really is retrying with
  // backoff, and the admin feed's permanent 'closed' state is the exact bug
  // this wording and that retry loop exist to avoid.
  return (
    <span className="flex items-center gap-1.5 text-xs text-amber-400">
      <WifiOff className="h-3.5 w-3.5" />
      Reconnecting…
    </span>
  );
}
