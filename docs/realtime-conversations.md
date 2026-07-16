# Realtime ticket conversations — integration contract

Live updates for public ticket conversations between HeyQ agents and external
customer clients (GGX Business+). This is the practical contract a client
implements; the API/DB remains the source of truth and the socket only carries
live signals.

Server: `server/realtime.ts` (an in-process WebSocket channel on the existing
Node API). Shared event types: `src/app/models/realtime.ts`.

## Endpoint

```
wss://<api-origin>/api/realtime
```

- Same origin as the REST API (`${API}/api/...`). In local dev the Vite proxy
  forwards the upgrade (`ws: true`).
- One socket may hold multiple ticket subscriptions. In practice a client opens a
  subscription per open ticket.
- **No credentials in the URL.** Authentication is a message after connect.

## Connection-token flow

Tokens are **short-lived (60 s), single-use**, and minted over REST. Knowing a
ticket id is never enough — the token binds identity and (for customers) the one
ticket the requester is authorized to see.

| Caller | Mint (REST) | Body | Returns |
|---|---|---|---|
| Agent | `POST /api/realtime/token` (internal route) | `{ agentId }` | `{ token, expiresInMs }` |
| Customer | `POST /api/customer/realtime/token` (public route) | `{ externalUserId, externalOrgId, ticketId }` | `{ token, expiresInMs }` |

The customer mint verifies the requester may see the ticket (same policy as the
REST reads, `server/visibility.ts`) and returns **404** otherwise — no token is
issued for a ticket that isn't theirs.

## Handshake

Client → server messages (JSON, discriminated by `t`):

```jsonc
{ "t": "auth", "token": "<token>" }               // first message; required
{ "t": "subscribe", "ticketId": "<id>" }          // after auth_ok
{ "t": "unsubscribe", "ticketId": "<id>" }
{ "t": "typing", "ticketId": "<id>", "state": "start" | "stop" }
{ "t": "ping" }                                    // optional heartbeat
```

Server → client messages:

```jsonc
{ "t": "welcome" }                                 // on connect
{ "t": "auth_ok", "audience": "agent" | "customer" }
{ "t": "auth_error", "reason": "invalid_token" }   // socket then closes (4001)
{ "t": "subscribed", "ticketId": "<id>" }
{ "t": "sub_error", "ticketId": "<id>", "reason": "forbidden" | "ticket_not_found" }
{ "t": "unsubscribed", "ticketId": "<id>" }
{ "t": "event", "event": { /* RealtimeEvent, see below */ } }
{ "t": "pong" }
{ "t": "error", "reason": "not_authenticated" }
```

Authorization rules enforced on `subscribe`:
- **Agent** tokens may subscribe to any existing ticket (agents are origin-trusted,
  as with every internal REST route today).
- **Customer** tokens may subscribe only to their one bound ticket **and** only if
  it is still visible to them; otherwise `sub_error: forbidden`.
- A `subscribe` before `auth` is rejected (`error: not_authenticated`).
- A socket that never authenticates within 10 s is closed.

## Event envelope

```ts
interface RealtimeEvent<Data> {
  id: string;              // stable — DE-DUPLICATE on this
  type: 'message.created' | 'ticket.status_changed' | 'ticket.assignment_changed'
      | 'typing.started' | 'typing.stopped';
  ticketId: string;
  actorType: 'agent' | 'requester' | 'system';
  serverTimestamp: string; // ISO-8601, authoritative for ORDERING
  data: Data;              // shape depends on type AND audience (below)
}
```

### `message.created`

Agent audience:
```jsonc
{ "messageKind": "public",        "message": { /* TicketMessage */ } }
{ "messageKind": "internal_note", "note":    { /* InternalNote  */ } }
```

Customer audience (public messages only — **internal notes are never sent**):
```jsonc
{ "messageKind": "public", "message": { /* CustomerTicketMessage */ } }
```

### `ticket.status_changed` (both audiences)
```jsonc
{ "status": "on_hold", "holdReason": "waiting_third_party", "fromStatus": "open" }
```

### `ticket.assignment_changed` (**agent audience only**)
```jsonc
{ "assigneeId": "l1_agent", "assigneeName": "Alex Cruz", "teamId": "team-cs", "teamName": "Customer Support" }
```
Never emitted to customers — assignee identity is agent-only.

### `typing.started` / `typing.stopped`
```jsonc
{ "label": "Requester" }   // customer-safe label; agents seen as "Support" by customers
```

## Typing rules

- Client emits a **throttled** `typing:start` (≤ once / 2 s) as the user types.
- Client emits `typing:stop` on **send, input clear, blur, navigation away, and
  disconnect**.
- The server auto-expires a typer after **4 s** of no `start`, and broadcasts
  `typing.stopped` on disconnect. Typing is **ephemeral** — never stored or
  returned by any REST read.
- Display a customer-safe label only (e.g. `Requester is typing…`).

## Reliability: reconnect, ordering, de-dup

- **Persist first, broadcast second.** Every event corresponds to an already-saved
  record; the socket is never the only copy of a reply.
- **De-duplicate** incoming events by `event.id`; de-duplicate messages by
  `message.id`. Re-applying the same id is a no-op.
- **Order** by `serverTimestamp` (then id) — do not assume socket arrival order.
- **Reconnect** automatically with backoff, re-minting a token each attempt.
- **Refetch after (re)connect**: pull the conversation via REST to recover any
  events missed while offline, then resume applying live events.
- **Fallback**: when the socket is unavailable, poll the REST read; the UI must
  stay fully functional without the socket.

## REST fallback / source of truth

| Purpose | Agent | Customer |
|---|---|---|
| Full ticket + conversation | `GET /api/tickets/:id/detail` | `GET /api/customer/tickets/:id` |
| Post a public reply | `POST /api/tickets/:id/agent-reply` | `POST /api/tickets/:id/messages` |
| List tickets | `GET /api/tickets` | `GET /api/customer/tickets` |

Replies accept optional `attachments: { name, size, type }[]` (metadata only).

## Customer-safe fields

A customer client may read only these fields off any message payload
(`CUSTOMER_SAFE_MESSAGE_FIELDS` in `src/app/models/realtime.ts`):

```
id, from, authorLabel, body, attachments, createdAt
```

Everything else — agent identity/`authorName`, internal notes, assignee, team
routing internals, SLA, escalation, support tier — is withheld from customer
channels by construction (`toCustomerMessage`), not by client-side filtering.
