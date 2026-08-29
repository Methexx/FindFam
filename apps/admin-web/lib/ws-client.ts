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
 * `core/network/ws_client.dart` already runs.
 */
const BASE_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

function backoffFor(attempt: number): number {
  const exponential = Math.min(BASE_BACKOFF_MS * 2 ** attempt, MAX_BACKOFF_MS);
  // Jitter so a backend restart doesn't bring every client back in lockstep.
  return exponential * (0.5 + Math.random() * 0.5);
}

function wsUrl(): string {
  const base = process.env.NEXT_PUBLIC_WS_URL ?? API_BASE_URL;
  return `${base.replace(/^http/, 'ws')}/ws`;
}

export interface ReconnectingSocketOptions {
  /** BFF route that mints a short-lived, ws-scoped token. */
  tokenUrl: string;
  /** The first frame sent once the socket opens. */
  authMessage: (token: string) => unknown;
  /** The server's acknowledgement type — `auth:ok` or `admin_auth:ok`. */
  authOkType: string;
  /** Every inbound message after a successful auth. */
  onMessage: (message: WsMessage) => void;
  /** Runs on every successful auth, first connection included. */
  onAuthenticated?: (send: (message: unknown) => void) => void;
  /**
   * Runs after each *re*connection, never after the first connect. Anything
   * broadcast while the socket was down is simply gone — the gateway has no
   * replay — so callers must re-fetch rather than assume continuity. Mobile's
   * `onReconnected` hook exists for exactly this.
   */
  onReconnected?: () => void;
}

export interface ReconnectingSocket {
  status: WsStatus;
  /** Returns false if the socket is not open, so callers can fall back. */
  send: (message: unknown) => boolean;
}

/**
 * One reconnecting WebSocket, shared by both surfaces.
 *
 * The admin SOS feed used to have its own client with no reconnect, no
 * backoff and no heartbeat: it set 'closed' on the first error and stayed
 * there, which behind Render's idle-socket-dropping proxy made a dead feed
 * look merely quiet. That is a bad failure mode for a chat map and a
 * genuinely dangerous one for an SOS feed, so both now run this.
 *
 * The server pings every 30s and terminates sockets that stop ponging;
 * browsers answer pings in the platform, so there is nothing to do here
 * beyond treating the resulting close as a reconnect trigger.
 */
export function useReconnectingSocket({
  tokenUrl,
  authMessage,
  authOkType,
  onMessage,
  onAuthenticated,
  onReconnected,
}: ReconnectingSocketOptions): ReconnectingSocket {
  const [status, setStatus] = useState<WsStatus>('connecting');
  const socketRef = useRef<WebSocket | null>(null);

  // Handlers live in refs so a caller re-rendering with fresh closures does
  // not tear down and rebuild the connection.
  const onMessageRef = useRef(onMessage);
  const onAuthenticatedRef = useRef(onAuthenticated);
  const onReconnectedRef = useRef(onReconnected);
  const authMessageRef = useRef(authMessage);
  onMessageRef.current = onMessage;
  onAuthenticatedRef.current = onAuthenticated;
  onReconnectedRef.current = onReconnected;
  authMessageRef.current = authMessage;

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
        const res = await fetch(tokenUrl);
        if (!res.ok) {
          // A 401 here means the session is genuinely gone, anything else is
          // transient. Both retry: redirecting to /login is middleware's job
          // on the next navigation, and yanking somebody off a live feed
          // because one token mint failed would be worse than waiting.
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
        socket.send(JSON.stringify(authMessageRef.current(token)));
      });

      socket.addEventListener('message', (event) => {
        let message: WsMessage;
        try {
          message = JSON.parse(event.data);
        } catch {
          return;
        }

        if (message.type === authOkType) {
          attempt = 0;
          setStatus('open');
          onAuthenticatedRef.current?.((outbound) => socket.send(JSON.stringify(outbound)));
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

      // 'error' is always followed by 'close' in browsers, so the reconnect is
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
  }, [tokenUrl, authOkType]);

  return { status, send };
}

export interface UseFindFamSocketOptions {
  onMessage: (message: WsMessage) => void;
  onReconnected?: () => void;
}

/**
 * The app-wide user WebSocket: authenticated with a short-lived ws-scoped
 * token minted by /api/auth/ws-token, because the `user_token` cookie is
 * httpOnly and unreadable from here.
 */
export function useFindFamSocket({
  onMessage,
  onReconnected,
}: UseFindFamSocketOptions): ReconnectingSocket {
  const authMessage = useCallback((token: string) => ({ type: 'auth', token }), []);

  const onAuthenticated = useCallback((send: (message: unknown) => void) => {
    // The gateway resolves circle membership once, at auth time. A circle
    // joined in another tab while this socket was open would otherwise
    // broadcast nothing until a reload, and one joined while it was *down*
    // would be missed entirely — so resync on every successful auth, which
    // the gateway explicitly expects clients to send rather than pushing
    // itself.
    send({ type: 'circles:resync' });
  }, []);

  return useReconnectingSocket({
    tokenUrl: '/api/auth/ws-token',
    authMessage,
    authOkType: 'auth:ok',
    onMessage,
    onAuthenticated,
    onReconnected,
  });
}
