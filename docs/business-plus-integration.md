# GGX Business+ Integration — HeyQ-side Contract (M22)

HeyQ's half of the Business+ support flow is **built and mocked**; this document
records the seam and what Business+ must later provide. Nothing here requires
the Business+ repository — the mock provider
(`src/app/services/orderProvider.ts` over `src/app/data/businessPlusOrders.ts`)
stands in for all of it.

## Division of ownership

**HeyQ owns:** tickets, requesters, organizations-as-support-entities,
assignment, teams, SLA, statuses, escalation, comments, internal notes,
attachments, notifications, reporting, and audit history. Nothing about a
ticket's lifecycle lives in Business+.

**Business+ owns:** the order catalogue, who is authenticated, and which orders
a user/organization is authorized to see. HeyQ never mutates a shipment and
never treats Business+ as a runtime foundation (product rule #11): a linked
ticket keeps working from its saved snapshot when Business+ is down, stale, or
the order is deleted upstream.

## The provider boundary (already in place)

`OrderProvider` in `src/app/services/orderProvider.ts` is the swap point. The
real integration replaces the mock behind `getOrderProvider()`; the consumers —
the contact form's order picker, `ticketService.createTicket`, and the agent's
`LinkedOrderPanel` — do not change.

| Interface method | Scope | Future Business+ endpoint |
|---|---|---|
| `listAuthorizedOrders(identity, query?)` | requester session | `GET /support/orders?query=` |
| `getAuthorizedOrder(identity, externalOrderId)` | requester session | `GET /support/orders/:externalOrderId` |
| `getOrderForSupport(externalOrderId)` | HeyQ service | `GET /internal/orders/:externalOrderId` |

Result unions are already production-shaped: `ok` / `forbidden` / `not_found` /
`unavailable` for lookups, `ok` / `unavailable` for lists. The UI handles each
today, so the real provider only has to map HTTP outcomes onto them.

## What HeyQ stores per linked ticket

Only reference data plus a snapshot (`LinkedOrder` in `models/ticket.ts`):

- `sourceSystem: 'ggx_business_plus'`
- `externalOrderId` — the stable Business+ order/shipment ID (**never** a HeyQ
  primary key; the ticket keeps its own generated id)
- `trackingNumber`
- `snapshot` captured at submission: shipment status, booking date, limited
  sender/recipient summaries, destination
- `capturedAt` — shown to agents so snapshot age is explicit

### Many transactions per ticket (M26)

One ticket may reference **many** transactions (the Business+ report drawer's
multi-select). HeyQ stores them as `Ticket.linkedTransactions: LinkedOrder[]`
(primary/originating first) and mirrors the first into the legacy `linkedOrder`,
so every existing single-transaction reader keeps working. `linkedOrdersOf(ticket)`
returns the normalized array for any era of ticket (multi, single, or legacy
`linkedOrder`-only). Business+ owns OMS authorization and pre-authorizes every
selected transaction, so the embedded-context path takes the list as given (only
the minimum per-transaction snapshot is stored). Consequences:

- **Customer projection** (`CustomerTicket`) returns `linkedTransactions` plus
  `linkedOrder` (= the first).
- **Agent list rows** carry `trackingNumbers` (all, primary first); the table shows
  the first plus "+N more", and **every** linked tracking number is searchable
  (`searchCorpus`). `trackingNumbersFor(ticket)` is the shared accessor.
- **Agent detail** replaces the single Linked Order panel with a compact
  `LinkedTransactionsPanel` (count heading, ≤3 rows tracking·status·origin→
  destination, "View all", and a per-transaction modal reusing `LinkedOrderPanel`
  for full details + the live-status check — one transaction at a time).

## What Business+ must provide (later)

1. **Authenticated user + organization identity** for the requester session,
   with **stable external IDs** (`externalUserId`, `externalOrgId`) that never
   change for a given user/org.
2. **Authorized order list / lookup** scoped to that identity — HeyQ passes the
   identity through and treats the provider's scoping as authoritative. Search
   should match order ID, tracking number, and recipient at minimum.
3. **Stable order/shipment ID** per order (`externalOrderId`), safe to store on
   tickets indefinitely.
4. **Order fields:** tracking number (GGX `XXXX-XXXX-XXXX` format), shipment
   status, booking date, and a **limited** sender/recipient summary (display
   strings, not full contact records — HeyQ shows exactly what it is given).
5. **Proof of order access:** the provider must be able to answer "may this
   user/org see this order" for a single ID — HeyQ re-checks at ticket-creation
   time, not only in the picker, and rejects the submission on `forbidden`.
6. **Launch/handoff into HeyQ:** a link from Business+ order screens carrying
   the order, today mocked as `/contact?order=<externalOrderId>` plus the
   simulated session. The real handoff must add a verifiable session context
   (e.g. signed token) that resolves to §1's identity; the deep link's
   *authorization behaviour* is already final — an out-of-scope order is
   refused with an explanation, never silently linked.

## Failure semantics (already enforced by tests)

- Provider down **before submission** → the picker degrades, the requester can
  always submit without a link.
- Provider errors **during submission** → creation fails atomically (no
  half-created ticket) with a message telling the requester they can submit
  without the order.
- Provider down / order deleted **after submission** → the ticket lists,
  searches, and renders from its snapshot; agents see an explicit notice.
- A live shipment change **never** changes HeyQ ticket status, and vice versa.

## Explicit non-goals for this milestone

No real SSO/OAuth, webhooks, email/SMS/push, queues, SDKs, real-time infra, or
direct database access; no shipment mutations; no Business+ frontend work.
