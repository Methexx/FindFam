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
        <Badge variant={connectionStatus === 'open' ? 'success' : 'secondary'}>
          {connectionStatus === 'open' ? 'Live' : connectionStatus}
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
                  <AlertTriangle className="h-5 w-5 shrink-0 text-destructive" />
                  <div>
                    <p className="font-semibold text-destructive">{event.username}</p>
                    <p className="text-sm text-destructive/80">
                      {event.origin.lat.toFixed(5)}, {event.origin.lng.toFixed(5)}
                    </p>
                    <p className="text-xs text-destructive/70">
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
