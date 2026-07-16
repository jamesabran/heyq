/**
 * realtime — the authenticated WebSocket channel for live ticket conversations.
 *
 * It runs IN-PROCESS on the existing HeyQ Node API (single Railway replica, so no
 * cross-instance fan-out is needed) and is attached to the same http.Server via
 * the `upgrade` event (see server/http.ts). The database/store stays the source
 * of truth: ticket lifecycle functions persist first, then call the `publish*`
 * helpers here to broadcast. This module never mutates ticket state.
 *
 * ── Connection lifecycle ─────────────────────────────────────────────────────
 * A socket connects to `/api/realtime` carrying NO credentials in the URL. It
 * must then:
 *   1. send `{ t: 'auth', token }` with a short-lived connection token minted
 *      over REST (POST /realtime/token for agents, POST /customer/realtime/token
 *      for customers). Unknown/expired tokens are rejected and the socket closed.
 *   2. send `{ t: 'subscribe', ticketId }`. The server authorizes the
 *      subscription (agents: ticket must exist; customers: the ticket must be
 *      visible to their identity). Merely knowing a ticket id grants nothing.
 *
 * ── Audience isolation ───────────────────────────────────────────────────────
 * Internal notes, agent identities, and assignment changes are AGENT-only and are
 * never delivered to customer subscribers. Public messages sent to customers are
 * projected through the same `toCustomerMessage` boundary the REST read uses.
 */
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import type { Server } from 'node:http';
import { teams } from '../src/app/data/catalog.ts';
import type { InternalNote, Ticket, TicketMessage, TicketStatus } from '../src/app/models/ticket.ts';
import type { ActorType, RealtimeEvent } from '../src/app/models/realtime.ts';
import { makeId, nowIso } from '../src/app/lib/mock.ts';
import { getStore } from './store.ts';
import { isVisibleToRequester, toCustomerMessage, type RequesterIdentity } from './visibility.ts';

const teamNameOf = (id: string): string => teams.find((t) => t.id === id)?.name ?? 'Unassigned';

// The event contract (types shared with the browser client) lives in
// src/app/models/realtime.ts and is documented in docs/realtime-conversations.md.
export type { ActorType, RealtimeEvent } from '../src/app/models/realtime.ts';

// ── Connection tokens (short-lived, single-use, minted over REST) ────────────

type Audience = 'agent' | 'customer';

interface TokenRecord {
  audience: Audience;
  storeId: string;
  agentId?: string;
  identity?: RequesterIdentity;
  /** Customer tokens are scoped to a single ticket. */
  ticketId?: string;
  expiresAt: number;
}

const TOKEN_TTL_MS = 60_000;
const tokens = new Map<string, TokenRecord>();

/** Mint an agent connection token. The agent frontend is origin-trusted (as today). */
export function mintAgentToken(storeId: string, agentId: string): { token: string; expiresInMs: number } {
  const token = makeId('rtok');
  tokens.set(token, { audience: 'agent', storeId, agentId, expiresAt: Date.now() + TOKEN_TTL_MS });
  return { token, expiresInMs: TOKEN_TTL_MS };
}

/**
 * Mint a customer connection token for ONE ticket, after verifying the requester
 * may see it. Throws if the ticket is not visible — the customer never gets a
 * token for a ticket that isn't theirs.
 */
export function mintCustomerToken(
  storeId: string,
  identity: RequesterIdentity,
  ticketId: string,
): { token: string; expiresInMs: number } {
  const store = getStore(storeId);
  const ticket = store.tickets.find((t) => t.id === ticketId);
  if (!ticket || !isVisibleToRequester(ticket, identity)) {
    throw new Error('Ticket not found');
  }
  const token = makeId('rtok');
  tokens.set(token, { audience: 'customer', storeId, identity, ticketId, expiresAt: Date.now() + TOKEN_TTL_MS });
  return { token, expiresInMs: TOKEN_TTL_MS };
}

function consumeToken(token: string): TokenRecord | null {
  const rec = tokens.get(token);
  if (!rec) return null;
  tokens.delete(token); // single-use
  if (rec.expiresAt < Date.now()) return null;
  return rec;
}

// ── Live connections + subscription registry ─────────────────────────────────

interface Conn {
  ws: WebSocket;
  authed: boolean;
  audience?: Audience;
  storeId: string;
  agentId?: string;
  identity?: RequesterIdentity;
  /** Customer connections may subscribe to this ticket only. */
  allowedTicketId?: string;
  subscriptions: Set<string>;
  /** ticketId → expiry timer; presence means "currently typing here". */
  typing: Map<string, ReturnType<typeof setTimeout>>;
  authTimer?: ReturnType<typeof setTimeout>;
}

/** roomKey = `${storeId}::${ticketId}` so isolated test stores never cross-talk. */
const rooms = new Map<string, Set<Conn>>();
const roomKey = (storeId: string, ticketId: string) => `${storeId}::${ticketId}`;

const TYPING_EXPIRY_MS = 4000;

function send(conn: Conn, obj: unknown): void {
  if (conn.ws.readyState === WebSocket.OPEN) conn.ws.send(JSON.stringify(obj));
}

function joinRoom(conn: Conn, ticketId: string): void {
  const key = roomKey(conn.storeId, ticketId);
  let room = rooms.get(key);
  if (!room) rooms.set(key, (room = new Set()));
  room.add(conn);
  conn.subscriptions.add(ticketId);
}

function leaveRoom(conn: Conn, ticketId: string): void {
  const key = roomKey(conn.storeId, ticketId);
  const room = rooms.get(key);
  if (room) {
    room.delete(conn);
    if (room.size === 0) rooms.delete(key);
  }
  conn.subscriptions.delete(ticketId);
}

function roomFor(storeId: string, ticketId: string): Set<Conn> | undefined {
  return rooms.get(roomKey(storeId, ticketId));
}

// ── Publish (called from ticket lifecycle AFTER persistence) ─────────────────

/**
 * A new public reply or internal note. Public replies go to both audiences
 * (projected for customers); internal notes go to AGENTS ONLY.
 */
export function publishMessage(
  storeId: string,
  ticket: Ticket,
  payload: { kind: 'public'; message: TicketMessage } | { kind: 'note'; note: InternalNote },
): void {
  const room = roomFor(storeId, ticket.id);
  if (!room || room.size === 0) return;

  const id = makeId('evt');
  const serverTimestamp = nowIso();
  const actorType: ActorType = payload.kind === 'note' ? 'agent' : payload.message.authorType;
  const supportTeam = teamNameOf(ticket.teamId);

  for (const conn of room) {
    if (conn.audience === 'agent') {
      const data =
        payload.kind === 'note'
          ? { messageKind: 'internal_note', note: payload.note }
          : { messageKind: 'public', message: payload.message };
      send(conn, { t: 'event', event: { id, type: 'message.created', ticketId: ticket.id, actorType, serverTimestamp, data } satisfies RealtimeEvent });
    } else {
      // Customer audience: internal notes NEVER cross this line.
      if (payload.kind !== 'public') continue;
      const data = { messageKind: 'public', message: toCustomerMessage(payload.message, supportTeam) };
      send(conn, { t: 'event', event: { id, type: 'message.created', ticketId: ticket.id, actorType, serverTimestamp, data } satisfies RealtimeEvent });
    }
  }
}

/** A workflow status change. Status is customer-safe, so both audiences receive it. */
export function publishStatusChanged(
  storeId: string,
  ticket: Ticket,
  actorType: ActorType,
  fromStatus?: TicketStatus,
): void {
  const room = roomFor(storeId, ticket.id);
  if (!room || room.size === 0) return;
  const event: RealtimeEvent = {
    id: makeId('evt'),
    type: 'ticket.status_changed',
    ticketId: ticket.id,
    actorType,
    serverTimestamp: nowIso(),
    data: { status: ticket.status, holdReason: ticket.holdReason, fromStatus },
  };
  for (const conn of room) send(conn, { t: 'event', event });
}

/**
 * An assignment / team change. Assignee identity is agent-only, so this is
 * delivered to AGENT subscribers only — customers never learn who is handling it.
 */
export function publishAssignmentChanged(
  storeId: string,
  ticket: Ticket,
  actorType: ActorType,
  assigneeName?: string,
): void {
  const room = roomFor(storeId, ticket.id);
  if (!room || room.size === 0) return;
  const event: RealtimeEvent = {
    id: makeId('evt'),
    type: 'ticket.assignment_changed',
    ticketId: ticket.id,
    actorType,
    serverTimestamp: nowIso(),
    data: { assigneeId: ticket.assigneeId, assigneeName, teamId: ticket.teamId, teamName: teamNameOf(ticket.teamId) },
  };
  for (const conn of room) {
    if (conn.audience === 'agent') send(conn, { t: 'event', event });
  }
}

// ── Typing (ephemeral — never persisted) ─────────────────────────────────────

/** The customer-safe label + actor for a typer, computed per RECIPIENT audience. */
function typingActorFor(sender: Conn, recipient: Conn): { actorType: ActorType; label: string } {
  if (sender.audience === 'customer') return { actorType: 'requester', label: 'Requester' };
  // Agent typing: other agents may see the name; customers only ever see "Support".
  if (recipient.audience === 'customer') return { actorType: 'agent', label: 'Support' };
  return { actorType: 'agent', label: sender.agentId ?? 'Agent' };
}

function broadcastTyping(sender: Conn, ticketId: string, started: boolean): void {
  const room = roomFor(sender.storeId, ticketId);
  if (!room) return;
  for (const conn of room) {
    if (conn === sender) continue; // never echo a typer to themselves
    const { actorType, label } = typingActorFor(sender, conn);
    const event: RealtimeEvent = {
      id: makeId('evt'),
      type: started ? 'typing.started' : 'typing.stopped',
      ticketId,
      actorType,
      serverTimestamp: nowIso(),
      data: { label },
    };
    send(conn, { t: 'event', event });
  }
}

function startTyping(conn: Conn, ticketId: string): void {
  if (!conn.subscriptions.has(ticketId)) return;
  const wasActive = conn.typing.has(ticketId);
  const existing = conn.typing.get(ticketId);
  if (existing) clearTimeout(existing);
  // Auto-expire after inactivity so a dropped "stop" can never strand the indicator.
  conn.typing.set(ticketId, setTimeout(() => stopTyping(conn, ticketId), TYPING_EXPIRY_MS));
  if (!wasActive) broadcastTyping(conn, ticketId, true); // one "started" per burst (rate-limited)
}

function stopTyping(conn: Conn, ticketId: string): void {
  const existing = conn.typing.get(ticketId);
  if (!existing) return;
  clearTimeout(existing);
  conn.typing.delete(ticketId);
  broadcastTyping(conn, ticketId, false);
}

// ── Subscription authorization ───────────────────────────────────────────────

function authorizeSubscribe(conn: Conn, ticketId: string): { ok: true } | { ok: false; reason: string } {
  const store = getStore(conn.storeId);
  const ticket = store.tickets.find((t) => t.id === ticketId);
  if (!ticket) return { ok: false, reason: 'ticket_not_found' };
  if (conn.audience === 'agent') return { ok: true };
  // Customer: the token is ticket-scoped AND the ticket must be visible to them.
  if (conn.allowedTicketId && conn.allowedTicketId !== ticketId) return { ok: false, reason: 'forbidden' };
  if (!conn.identity || !isVisibleToRequester(ticket, conn.identity)) return { ok: false, reason: 'forbidden' };
  return { ok: true };
}

// ── Message handling ─────────────────────────────────────────────────────────

interface ClientMessage {
  t: string;
  token?: string;
  ticketId?: string;
  state?: 'start' | 'stop';
}

function parse(raw: RawData): ClientMessage | null {
  try {
    const obj = JSON.parse(raw.toString());
    return obj && typeof obj === 'object' && typeof obj.t === 'string' ? (obj as ClientMessage) : null;
  } catch {
    return null;
  }
}

function handleAuth(conn: Conn, token?: string): void {
  const rec = token ? consumeToken(token) : null;
  if (!rec) {
    send(conn, { t: 'auth_error', reason: 'invalid_token' });
    conn.ws.close(4001, 'invalid token');
    return;
  }
  conn.authed = true;
  conn.audience = rec.audience;
  conn.storeId = rec.storeId;
  conn.agentId = rec.agentId;
  conn.identity = rec.identity;
  conn.allowedTicketId = rec.ticketId;
  if (conn.authTimer) clearTimeout(conn.authTimer);
  send(conn, { t: 'auth_ok', audience: rec.audience });
}

function onMessage(conn: Conn, raw: RawData): void {
  const msg = parse(raw);
  if (!msg) return;

  if (msg.t === 'auth') return handleAuth(conn, msg.token);
  if (msg.t === 'ping') return send(conn, { t: 'pong' });

  if (!conn.authed) {
    send(conn, { t: 'error', reason: 'not_authenticated' });
    return;
  }

  switch (msg.t) {
    case 'subscribe': {
      if (!msg.ticketId) return;
      const auth = authorizeSubscribe(conn, msg.ticketId);
      if (!auth.ok) {
        send(conn, { t: 'sub_error', ticketId: msg.ticketId, reason: auth.reason });
        return;
      }
      joinRoom(conn, msg.ticketId);
      send(conn, { t: 'subscribed', ticketId: msg.ticketId });
      return;
    }
    case 'unsubscribe': {
      if (!msg.ticketId) return;
      stopTyping(conn, msg.ticketId);
      leaveRoom(conn, msg.ticketId);
      send(conn, { t: 'unsubscribed', ticketId: msg.ticketId });
      return;
    }
    case 'typing': {
      if (!msg.ticketId) return;
      if (msg.state === 'start') startTyping(conn, msg.ticketId);
      else stopTyping(conn, msg.ticketId);
      return;
    }
  }
}

function onClose(conn: Conn): void {
  if (conn.authTimer) clearTimeout(conn.authTimer);
  // Disconnect implies typing.stopped everywhere, and drops all subscriptions.
  for (const ticketId of [...conn.subscriptions]) {
    stopTyping(conn, ticketId);
    leaveRoom(conn, ticketId);
  }
}

const AUTH_GRACE_MS = 10_000;

function handleConnection(ws: WebSocket): void {
  const conn: Conn = {
    ws,
    authed: false,
    storeId: 'default',
    subscriptions: new Set(),
    typing: new Map(),
  };
  conn.authTimer = setTimeout(() => {
    if (!conn.authed) ws.close(4002, 'auth timeout');
  }, AUTH_GRACE_MS);

  ws.on('message', (raw) => onMessage(conn, raw));
  ws.on('close', () => onClose(conn));
  ws.on('error', () => {/* surfaced via close */});
  send(conn, { t: 'welcome' });
}

/**
 * Attach the WebSocket server to an existing http.Server. Only `/api/realtime`
 * (or `/realtime`) upgrades are accepted; every other upgrade is destroyed.
 */
export function attachRealtime(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (req, socket, head) => {
    const path = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (path === '/api/realtime' || path === '/realtime') {
      wss.handleUpgrade(req, socket, head, (ws) => handleConnection(ws));
    } else {
      socket.destroy();
    }
  });
  return wss;
}

/** Test-only: drop all live rooms/tokens so a fresh test starts clean. */
export function __resetRealtimeForTest(): void {
  for (const room of rooms.values()) {
    for (const conn of room) conn.ws.close();
  }
  rooms.clear();
  tokens.clear();
}
