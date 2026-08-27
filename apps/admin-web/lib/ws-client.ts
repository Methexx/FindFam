'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from './user-session';

export type WsStatus = 'connecting' | 'open' | 'offline';

export interface WsMessage {
  type: string;
  payload?: unknown;
  error?: string;
}

/**
 * Exponential backoff, 1s doubling to a 30s cap — the same schedule mobile's
 * `core/network/ws_client.dart` already runs. `lib/admin-ws-client.ts` has
 * none of this: it sets 'closed' on the first error and stays there, which
 * behind Render's idle-socket-dropping proxy makes a dead feed look merely
 * quiet.
 */
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

function backoffFor(attempt: number): number {
  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  // Jitter so a backend restart doesn't bring every client back in lockstep.
  return exponential * (0.5 + Math.random() * 0.5);
}

function wsUrl(): string {
  const base = process.env.NEXT_PUBLIC_WS_URL ?? API_BASE_URL.replace(/^http/, 'ws');
  return `${base.replace(/^http/, 'ws')}/ws`;
}

export interface UseFindFamSocketOptions {
  /** Every inbound message after a successful auth. */
  onMessage: (message: WsMessage) => void;
  /**
   * Called after each *re*connection, never after the first connect.
   * Anything broadcast while the socket was down is simply gone, so the
   * caller must re-fetch rather than assume continuity — mobile's
   * `onReconnected` hook exists for exactly this and is used to re-run
   * GET /circles/:id/locations/latest.
   */
  onReconnected?: () => void;
}

export interface FindFamSocket {
  status: WsStatus;
  /** Returns false if the socket is not open, so callers can fall back. */
  send: (message: unknown) => boolean;
}

/**
 * The app-wide user WebSocket: one connection, authenticated with a
 * short-lived ws-scoped token minted by /api/auth/ws-token (the `user_token`
 * cookie is httpOnly and unreadable from here).
 */
export function useFindFamSocket({
  onMessage,
  onReconnected,
}: UseFindFamSocketOptions): FindFamSocket {
  const [status, setStatus] = useState<WsStatus>('connecting');
  const socketRef = useRef<WebSocket | null>(null);

  // Handlers live in refs so a caller re-rendering with fresh closures does
  // not tear down and rebuild the connection.
  const onMessageRef = useRef(onMessage);
  const onReconnectedRef = useRef(onReconnected);
  onMessageRef.current = onMessage;
  onReconnectedRef.current = onReconnected;

  const send = useCallback((message: unknown): boolean => {
    const socket = socketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }, []);

  useEffect(() => {
    let disposed = false;
    let attempt = 0;
    let hasConnectedBefore = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const scheduleReconnect = () => {
      if (disposed) return;
      setStatus('offline');
      reconnectTimer = setTimeout(connect, backoffFor(attempt));
      attempt += 1;
    };

    async function connect() {
      if (disposed) return;
      setStatus('connecting');

      let token: string;
      try {
        const res = await fetch('/api/auth/ws-token');
        if (!res.ok) {
          // 401 here means the session is genuinely gone; anything else is a
          // transient failure. Both are retried — a redirect to /login is
          // middleware's job on the next navigation, and yanking somebody off
          // a live map because one token mint failed would be worse.
          scheduleReconnect();
          return;
        }
        token = (await res.json()).token;
      } catch {
        scheduleReconnect();
        return;
      }

      if (disposed) return;

      const socket = new WebSocket(wsUrl());
      socketRef.current = socket;

      socket.addEventListener('open', () => {
        socket.send(JSON.stringify({ type: 'auth', token }));
      });

      socket.addEventListener('message', (event) => {
        let message: WsMessage;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message.type === 'auth:ok') {
          attempt = 0;
          setStatus('open');

          // The gateway resolves circle membership once, at auth time. A
          // circle joined in another tab while this socket was open would
          // otherwise broadcast nothing until a reload, and one joined while
          // it was *down* would be missed entirely — so resync on every
          // successful auth, which the gateway explicitly expects clients to
          // send rather than pushing it itself.
          socket.send(JSON.stringify({ type: 'circles:resync' }));

          if (hasConnectedBefore) onReconnectedRef.current?.();
          hasConnectedBefore = true;
          return;
        }

        onMessageRef.current(message);
      });

      socket.addEventListener('close', () => {
        if (disposed) return;
        scheduleReconnect();
      });

      // 'error' is always followed by 'close' in browsers, so reconnection is
      // scheduled there rather than twice.
      socket.addEventListener('error', () => {
        setStatus('offline');
      });
    }

    void connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, []);

  return { status, send };
}
