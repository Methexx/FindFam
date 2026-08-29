'use client';

import type { AdminSosEvent } from '@findfam/shared-types';
import { AlertTriangle } from 'lucide-react';
import { useAdminSosFeed } from '../../../lib/admin-ws-client';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

export default function SosLiveFeed({ initialEvents }: { initialEvents: AdminSosEvent[] }) {
  const { events, connectionStatus } = useAdminSosFeed(initialEvents);
  const activeEvents = events.filter((event) => event.status === 'active');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Active SOS Events</h1>
        {/* "Reconnecting", not "closed": the feed now retries with backoff
            instead of dying on the first error, and the badge should say
            which of those is happening. */}
        <Badge variant={connectionStatus === 'open' ? 'success' : 'secondary'}>
          {connectionStatus === 'open'
            ? 'Live'
            : connectionStatus === 'connecting'
              ? 'Connecting…'
              : 'Reconnecting…'}
        </Badge>
      </div>

      {activeEvents.length === 0 ? (
        <Card variant="glass">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No active SOS events.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {activeEvents.map((event) => (
            <Card
              key={event.id}
              variant="glass"
              className="border-destructive/40 bg-destructive/5 shadow-glow shadow-destructive/20"
            >
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="flex items-center gap-3">
                  {/* text-destructive itself is a dark red meant to sit under
                      light foreground text on a solid destructive background
                      (see Badge below) — reused as foreground text here it
                      fails WCAG AA against a dark card, so these three lines
                      use the lighter red-400 scale instead. */}
                  <AlertTriangle className="h-5 w-5 shrink-0 text-red-400" />
                  <div>
                    <p className="font-semibold text-red-400">{event.username}</p>
                    <p className="text-sm text-red-400/90">
                      {event.origin.lat.toFixed(5)}, {event.origin.lng.toFixed(5)}
                    </p>
                    <p className="text-xs text-red-400/80">
                      Triggered {new Date(event.triggeredAt).toLocaleTimeString()}
                    </p>
                  </div>
                </div>
                <Badge variant="destructive">Active</Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
