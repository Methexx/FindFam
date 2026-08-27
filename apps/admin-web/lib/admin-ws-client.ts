'use client';

import { useCallback, useState } from 'react';
import type { AdminSosEvent } from '@findfam/shared-types';
import { useReconnectingSocket, type WsStatus, type WsMessage } from './ws-client';

export type AdminSosConnectionStatus = WsStatus;

interface UseAdminSosFeedResult {
  events: AdminSosEvent[];
  connectionStatus: AdminSosConnectionStatus;
}

/**
 * The admin live SOS feed.
 *
 * This used to be a self-contained socket with no reconnect, no backoff and
 * no heartbeat — the first error set 'closed' permanently. Behind Render's
 * idle-socket-dropping proxy that meant the feed silently died and looked
 * merely quiet, which for an SOS feed is the worst available failure mode.
 * It now runs on the shared client in ws-client.ts, so it reconnects with
 * backoff and reconciles on the way back.
 */
export function useAdminSosFeed(initialEvents: AdminSosEvent[]): UseAdminSosFeedResult {
  const [events, setEvents] = useState<AdminSosEvent[]>(initialEvents);

  const authMessage = useCallback((token: string) => ({ type: 'admin_auth', token }), []);

  const onMessage = useCallback((message: WsMessage) => {
    if (message.type === 'sos:broadcast') {
      const payload = message.payload as AdminSosEvent;
      setEvents((previous) => [payload, ...previous.filter((event) => event.id !== payload.id)]);
      return;
    }

    if (message.type === 'sos:resolved') {
      const payload = message.payload as Partial<AdminSosEvent> & { id: string };
      setEvents((previous) =>
        previous.map((event) => (event.id === payload.id ? { ...event, ...payload } : event)),
      );
    }
  }, []);

  // Events raised while the socket was down were never delivered, so the
  // list is re-read rather than left with a hole in it. Without this the
  // feed would come back looking healthy while missing exactly the events
  // that happened during the outage.
  const onReconnected = useCallback(() => {
    void (async () => {
      const res = await fetch('/api/admin/sos-active');
      if (!res.ok) return;
      const body = await res.json();
      if (Array.isArray(body.data)) setEvents(body.data as AdminSosEvent[]);
    })();
  }, []);

  const { status } = useReconnectingSocket({
    tokenUrl: '/api/admin/ws-token',
    authMessage,
    authOkType: 'admin_auth:ok',
    onMessage,
    onReconnected,
  });

  return { events, connectionStatus: status };
}
