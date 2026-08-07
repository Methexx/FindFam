'use client';

import { useEffect, useRef, useState } from 'react';
import type { AdminSosEvent } from '@findfam/shared-types';

export type AdminSosConnectionStatus = 'connecting' | 'open' | 'closed';

interface UseAdminSosFeedResult {
  events: AdminSosEvent[];
  connectionStatus: AdminSosConnectionStatus;
}

function wsBaseUrl(): string {
  const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:3000';
  return apiBaseUrl.replace(/^http/, 'ws');
}

/**
 * Opens the admin WS connection for the live SOS feed: fetches a short-lived
 * token via /api/admin/ws-token (the admin_token cookie itself is httpOnly
 * and unreadable from here), authenticates with `admin_auth`, and merges
 * `sos:broadcast`/`sos:resolved` events into the initial REST-fetched list.
 */
export function useAdminSosFeed(initialEvents: AdminSosEvent[]): UseAdminSosFeedResult {
  const [events, setEvents] = useState<AdminSosEvent[]>(initialEvents);
  const [connectionStatus, setConnectionStatus] = useState<AdminSosConnectionStatus>('connecting');
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function connect() {
      const tokenRes = await fetch('/api/admin/ws-token');
      if (!tokenRes.ok || cancelled) return;
      const { token } = await tokenRes.json();

      const socket = new WebSocket(`${wsBaseUrl()}/ws`);
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ type: 'admin_auth', token }));
      });

      socket.addEventListener('message', (event) => {
        const message = JSON.parse(event.data);
        if (message.type === 'admin_auth:ok') {
          setConnectionStatus('open');
          return;
        }
        if (message.type === 'sos:broadcast') {
          setEvents((prev) => [message.payload, ...prev.filter((e) => e.id !== message.payload.id)]);
        }
        if (message.type === 'sos:resolved') {
          setEvents((prev) =>
            prev.map((e) => (e.id === message.payload.id ? { ...e, ...message.payload } : e)),
          );
        }
      });

      socket.addEventListener('close', () => setConnectionStatus('closed'));
      socket.addEventListener('error', () => setConnectionStatus('closed'));
    }

    void connect();

    return () => {
      cancelled = true;
      socketRef.current?.close();
    };
  }, []);

  return { events, connectionStatus };
}
