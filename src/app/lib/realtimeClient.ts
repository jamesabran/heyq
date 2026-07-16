/**
 * realtimeClient — the browser side of the realtime channel.
 *
 * Opens ONE ticket-scoped WebSocket subscription and keeps it alive: it mints a
 * fresh connection token, authenticates, subscribes, and transparently
 * reconnects with backoff (re-minting each attempt). The API/DB stays the source
 * of truth — this only carries live signals; callers refetch history on
 * (re)connect to recover anything missed while offline.
 *
 * Where WebSocket is unavailable (jsdom under test, SSR), it degrades to a no-op
 * that reports 'offline' so the caller can fall back to REST polling.
 */
import { realtimeUrl } from './apiClient';
import type { RealtimeEvent } from '../models/realtime';

export type RealtimeStatus = 'connecting' | 'live' | 'offline';

/** True only where the platform can actually open a WebSocket. */
export const realtimeSupported = typeof WebSocket !== 'undefined';

export interface TicketChannel {
  /** Send a throttled typing signal for this ticket. No-op when not live. */
  sendTyping: (state: 'start' | 'stop') => void;
  /** Close the subscription for good (unsubscribe + no further reconnects). */
  close: () => void;
}

export interface ChannelOptions {
  ticketId: string;
  /** Obtain a fresh short-lived connection token (called on every connect). */
  fetchToken: () => Promise<string>;
  onEvent: (event: RealtimeEvent) => void;
  onStatus: (status: RealtimeStatus) => void;
}

const MAX_BACKOFF_MS = 15_000;
const PING_INTERVAL_MS = 25_000;

/** Open a live subscription to one ticket. Returns handles to type + close. */
export function openTicketChannel(opts: ChannelOptions): TicketChannel {
  if (!realtimeSupported) {
    opts.onStatus('offline');
    return { sendTyping: () => {}, close: () => {} };
  }

  let ws: WebSocket | null = null;
  let closedByUser = false;
  let subscribed = false;
  let attempt = 0;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  let pingTimer: ReturnType<typeof setInterval> | undefined;

  const clearTimers = () => {
    if (reconnectTimer) clearTimeout(reconnectTimer);
    if (pingTimer) clearInterval(pingTimer);
    reconnectTimer = undefined;
    pingTimer = undefined;
  };

  const scheduleReconnect = () => {
    if (closedByUser) return;
    const delay = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt);
    attempt += 1;
    reconnectTimer = setTimeout(connect, delay);
  };

  async function connect(): Promise<void> {
    if (closedByUser) return;
    opts.onStatus('connecting');

    let token: string;
    try {
      token = await opts.fetchToken();
    } catch {
      scheduleReconnect(); // token endpoint down → treat as an outage, retry
      return;
    }
    if (closedByUser) return;

    const socket = new WebSocket(realtimeUrl());
    ws = socket;

    socket.onopen = () => socket.send(JSON.stringify({ t: 'auth', token }));

    socket.onmessage = (e) => {
      let msg: { t: string; event?: RealtimeEvent };
      try {
        msg = JSON.parse(typeof e.data === 'string' ? e.data : String(e.data));
      } catch {
        return;
      }
      switch (msg.t) {
        case 'auth_ok':
          socket.send(JSON.stringify({ t: 'subscribe', ticketId: opts.ticketId }));
          break;
        case 'subscribed':
          attempt = 0;
          subscribed = true;
          opts.onStatus('live');
          pingTimer = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ t: 'ping' }));
          }, PING_INTERVAL_MS);
          break;
        case 'event':
          if (msg.event) opts.onEvent(msg.event);
          break;
        // auth_error / sub_error are followed by a close → handled in onclose.
      }
    };

    socket.onerror = () => {/* an onclose always follows */};
    socket.onclose = () => {
      subscribed = false;
      if (pingTimer) clearInterval(pingTimer);
      pingTimer = undefined;
      if (!closedByUser) {
        opts.onStatus('offline');
        scheduleReconnect();
      }
    };
  }

  connect();

  return {
    sendTyping: (state) => {
      if (ws && ws.readyState === WebSocket.OPEN && subscribed) {
        ws.send(JSON.stringify({ t: 'typing', ticketId: opts.ticketId, state }));
      }
    },
    close: () => {
      closedByUser = true;
      clearTimers();
      if (ws) {
        try {
          if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ t: 'unsubscribe', ticketId: opts.ticketId }));
        } catch {
          /* closing anyway */
        }
        ws.close();
      }
    },
  };
}
