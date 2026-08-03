# HeyQ Integration Readiness — Audit for Partner Teams

**Audience:** GGX Business+, OMS, Platform/Infra, Identity, Design System.
**Date of audit:** 2026-07-31 · **Commit:** `1d2839a` · **Branch:** `master`
**Method:** direct read of `server/`, `src/app/`, deployment config, and `docs/`.
Test suite at time of audit: **307 tests / 41 files, all passing**.

> **Nothing in this document is a signed contract.** Where HeyQ has written down
> an intended endpoint, it is labelled **HeyQ proposal**. Where no contract
> exists at all, it is labelled **TO BE DEFINED**. Assumptions HeyQ currently
> makes are called out explicitly so partner teams can confirm or reject them.

---

## Part A — Cross-cutting facts every partner team must know first

These four facts change how every integration below should be read. They are not
per-integration caveats; they are the current state of the whole system.

### A1. There is no authentication anywhere in HeyQ

**Status: not implemented.** Not partially — not at all.

- **Agents:** identity is a client-side React dropdown (`src/app/contexts/IdentityContext.tsx`,
  seven hardcoded demo identities persisted to `localStorage`). Role gating
  (`src/app/lib/roles.ts`, `RequireRole.tsx`) is **UI-only** and is stated as such
  in the source.
- **Server:** `server/http.ts` has no auth middleware, no token verification, no
  session. Every authorization input is **caller-supplied**:
  `agentId` (body), `externalUserId` / `externalOrgId` (query string),
  `viewerId` / `viewerTeamId` (query string), `reviewerId` (body).
- **The only boundary that exists** is origin-based route gating: each route is
  tagged `public` or `internal` (default `internal`), and a request to an
  `internal` route carrying a **known customer origin** is refused `403`
  (`server/http.ts:626`). Requests with **no `Origin` header** — i.e. any
  server-to-server or scripted caller — bypass this entirely, by design.
- **Consequence:** `GET /api/customer/tickets?externalOrgId=bp-org-acme` returns
  that organisation's tickets to anyone who sends that string. The visibility
  *policy* (`server/visibility.ts`) is correct and well-factored; the *identity*
  it is applied to is unverified.

This is deliberate and documented (`docs/deployment.md`, "no auth at this mock
stage"). It is nonetheless the single largest blocker to any production
integration, and every partner team's work depends on how it is resolved.

### A2. There is no database

`server/store.ts` holds all state in a `Map` of in-memory objects seeded from
`server/seed.ts`. Attachment **bytes** live in a separate module-level
`Map<string, Buffer>` (`server/attachments.ts:55`). Consequences:

- State resets on every restart/redeploy.
- `railway.json` pins `numReplicas: 1`; the realtime subscription registry and
  the store are both in-process, so horizontal scaling is currently impossible.
- No migrations, no backup, no retention policy, no audit durability.

### A3. Test-only routes are mounted in the production route table

`POST /api/_test/down` (simulates a provider outage) and
`PATCH /api/_test/business-plus-orders/:externalOrderId` (mutates order status)
are registered in `server/http.ts:179-193`. They are `internal`-tagged, so a
browser on a known customer origin is refused — but any caller without an
`Origin` header can invoke them against the deployed API. Flagged for removal or
env-gating before any real integration traffic.

### A4. Two contradictory trust models for linked orders coexist

HeyQ has **two** Business+ ticket-creation paths with **opposite** trust
assumptions. This is an unresolved product decision, not a bug, but partner teams
must know which one they are building against:

| Path | Entry point | Trust model |
|---|---|---|
| HeyQ contact form order picker | `POST /api/tickets` with `businessPlusOrder` | HeyQ **re-verifies** order authorization at creation (`server/tickets.ts:186`); an out-of-scope order fails the submission atomically |
| Embedded Business+ report drawer | `POST /api/customer/tickets` with `businessPlusContext` | HeyQ **trusts** the caller: identity and every linked transaction are taken as given, with the comment "Business+ already authorized every order via OMS" (`server/tickets.ts:224`) |

The second path is the one Business+ actually uses. Combined with A1, it means
the trusted assertion is currently unauthenticated.

---

## Part B — GGX Business+ integration

**Owning team:** GGX Business+ (separate repository — `../GGX Corporate`, per
`docs/session-state.md`). **HeyQ-side contract doc:** `docs/business-plus-integration.md`.

**Division of ownership (settled, per `docs/product-rules.md` #25):** HeyQ owns
tickets, conversations, attachments, SLA, routing, audit. Business+ owns
authenticated identity and which orders a user may see. Business+ is a *context
provider, never the system of record*.

### B1. Ticket creation (embedded report drawer)

| Field | Value |
|---|---|
| **Purpose** | A signed-in Business+ user files a support ticket from inside Business+, optionally linked to one or many transactions |
| **Status** | **Implemented** (HeyQ side), **not yet consumed** by Business+ |
| **Direction** | Business+ → HeyQ (write) |
| **Route** | `POST /api/customer/tickets` — `access: 'public'` (`server/http.ts:534`) |
| **Handlers** | `server/customer.ts:createCustomerTicket` → `server/tickets.ts:createTicket` |
| **Auth** | **None.** Origin must not be blocked; identity is body-supplied |

**Request — JSON body or `multipart/form-data`:**

| Field | Required | Notes |
|---|---|---|
| `externalUserId`, `externalOrgId` | yes (functionally) | Trusted as-is; becomes ticket provenance and drives all later visibility |
| `name`, `email` | yes | Creates/uses a guest requester record |
| `subject`, `description` | yes | |
| `concernType` | no | Must be one of 11 `ConcernType` values (`src/app/models/ticket.ts:55`); anything else silently falls back to `general_inquiry` |
| `linkedTransactions` | no | `LinkedOrder[]`, **primary/originating first** — ordering is preserved end to end |
| `linkedOrder` | no | Legacy single-order form; mirrored from `linkedTransactions[0]` |
| `files` (multipart part name) | no | ≤5 files, ≤10 MB each, extension+MIME allowlist, encrypted archives rejected (`src/app/lib/attachmentPolicy.ts`) |

`LinkedOrder` shape (`src/app/models/ticket.ts:401`): `externalOrderId`,
`trackingNumber`, `capturedAt`, and `snapshot { shipmentStatus, bookingDate,
destination?, senderSummary?, recipientSummary?, serviceType?, deliverySummary?,
route? }`. Everything past `bookingDate` is optional — HeyQ renders exactly what
it is given and never invents the rest.

**Response:** the `CustomerTicket` projection only (`src/app/models/ticket.ts:443`)
— never the agent record. Files are validated **before** the ticket is created,
so a rejected batch never half-creates.

**Business+ must provide / confirm:** stable `externalUserId` / `externalOrgId`
that never change; the concern-type vocabulary mapping; agreement that
`linkedTransactions[0]` is the originating transaction; how a verified session
replaces the plain body fields.

**Risks:** identity is unauthenticated (A1/A4); concern-type mismatches degrade
silently rather than erroring; no idempotency key, so a retried submit creates a
duplicate ticket.

### B2. Ticket list and search (customer)

- **Status: implemented.** `GET /api/customer/tickets?externalUserId=&externalOrgId=` (`public`).
- Returns every ticket visible to that requester, newest-activity first, as
  `CustomerTicket[]` with full message threads inlined.
- **Visibility policy** (`server/visibility.ts`) is the strong part of this
  integration and is worth partner review: a ticket is exposed only when
  `customerVisible` **and** org matches **and** (`accountVisible` or the exact
  user matches). Order ownership is deliberately *not* authorization — the file
  never reads `linkedOrder` when deciding visibility.
- **Gaps:** no pagination, no filtering, no sorting, no search parameters at all
  (verified — zero `limit`/`offset`/`cursor` in the server). The whole list plus
  every message body is returned in one response. Will not scale.

### B3. Ticket details (customer)

- **Status: implemented.** `GET /api/customer/tickets/:id?externalUserId=&externalOrgId=` (`public`).
- Returns `404` for a ticket that is not visible — a requester learns nothing
  about tickets that are not theirs.
- `CustomerTicket` is the privacy boundary *by type*: it has no field for
  internal notes, assignee identity, escalation state, support tier, SLA, or team
  queue, so none can be serialized by accident.

### B4. Linked transactions / tracking numbers

- **Status: implemented** (multi-transaction landed in `1d2839a`).
- One ticket → many `LinkedOrder`s, stored as `Ticket.linkedTransactions`, with
  `linkedOrder` mirroring the first for legacy readers. `linkedOrdersOf(ticket)`
  is the single normalizing accessor.
- Agent list rows carry **all** tracking numbers (primary first); every linked
  tracking number is searchable. Agent detail shows `LinkedTransactionsPanel`
  (count, ≤3 rows, "View all", per-transaction modal).
- **Snapshot semantics:** HeyQ stores reference data + a snapshot captured at
  submission. A ticket keeps working when Business+/OMS is down, stale, or the
  order was deleted upstream. A live shipment change **never** moves ticket
  status, and no HeyQ action mutates a shipment.
- **Unresolved:** no cap on how many transactions may be linked; no way to add or
  remove a linked transaction after creation from the customer side.

### B5. Ticket status updates

- **Status: implemented, HeyQ-owned.** Six statuses only (`new`, `open`,
  `in_progress`, `on_hold`, `resolved`, `closed`); "reopened" is an event with a
  `reopenedAt` timestamp, not a status; escalation is a separate dimension.
- Customer-initiated: `POST /api/tickets/:id/reopen` (`public`) — no body, no
  identity check beyond origin. **Risk:** any caller can reopen any ticket by id.
- Status changes broadcast to both audiences over the realtime channel as
  `ticket.status_changed`.
- Business+ must render `status` (support ticket) as **distinct** from the
  shipment status on the linked order. They are independent by product rule.

### B6. Customer and agent conversation replies

- **Status: implemented, both directions.**
- Customer reply: `POST /api/tickets/:id/messages` (`public`) — JSON `{ body, attachments }`
  or multipart with `files`. **Risk:** no identity parameter at all; ticket id is
  the only thing required.
- Agent reply: `POST /api/tickets/:id/agent-reply` (`internal`) — `{ agentId, body }` or multipart.
- Internal notes are a **separate entity** (`POST /api/tickets/:id/notes`) that
  cannot reach a customer surface by construction.
- Customer-facing messages are projected through `toCustomerMessage` — agent real
  names are replaced by the handling **team** name. Customer-safe fields are
  enumerated in `CUSTOMER_SAFE_MESSAGE_FIELDS` (`src/app/models/realtime.ts`).

### B7. Attachments

- **Status: implemented server-side** (commit `9bc9b2d`), **storage is in-memory**.
- Upload: multipart on ticket creation, customer reply, or agent reply.
- List: `GET /api/customer/tickets/:id/attachments` (`public`, visibility-gated)
  and `GET /api/tickets/:id/attachments` (`internal`).
- Download: `GET /api/customer/tickets/:id/attachments/:attachmentId?disposition=inline`
  — ticket-level authorization first, then the attachment must belong to *that*
  ticket, so a caller authorized for ticket A cannot read ticket B's file by
  guessing an id.
- Security handling is solid: server-generated object keys (never the original
  filename, so no path traversal), `X-Content-Type-Options: nosniff`,
  `Cache-Control: private, no-store`, header-injection-safe filename
  sanitisation, inline rendering only for validated images/PDFs.
- **Gaps:** no malware/AV scanning (explicitly listed as a production requirement
  in `docs/backend-readiness.md`); no object storage (S3/GCS/Blob) — the code
  notes that swapping the map touches only `putBlob`/`getBlob`; no retention or
  deletion; no size cap on total ticket storage.

### B8. Customer identity and authorization

- **Status: mocked.** `IdentityContext` carries a *simulated* Business+ session:
  `{ externalUserId: 'bp-user-nadia', externalOrgId: 'bp-org-acme', orgName: 'Acme Retail Corp' }`.
- The handoff deep link is `/contact?order=<externalOrderId>` (`src/app/pages/ContactPage.tsx:46`).
  Its **authorization behaviour** is final — an out-of-scope order is refused with
  an explanation, never silently linked — but the **session** is simulated.
- **Business+ must provide:** a verifiable session context (signed token or
  equivalent) that HeyQ can validate to derive `externalUserId` / `externalOrgId`;
  the ID stability guarantee; and a decision on whether HeyQ trusts Business+'s
  assertion (A4) or independently verifies.

### B9. Live updates, typing indicators, and notifications

- **Status: implemented** (`server/realtime.ts`, `docs/realtime-conversations.md`).
  This is the most production-shaped integration in the repo.
- Endpoint: `wss://<api-origin>/api/realtime`, same origin as REST, attached to
  the same `http.Server` via the `upgrade` event — no separate service or port.
- **Connection tokens:** 60-second, single-use, minted over REST
  (`POST /api/customer/realtime/token` with `{ externalUserId, externalOrgId, ticketId }`).
  The mint verifies visibility and returns **404** if the ticket is not theirs —
  no token is issued for a ticket that is not yours. **No credentials in the URL.**
- Customer tokens are bound to **one** ticket; agent tokens may subscribe to any
  existing ticket. Unauthenticated sockets are closed after 10 s.
- Event envelope carries a stable `id` (de-duplicate on it) and an authoritative
  `serverTimestamp` (order on it, not arrival order). Persist-first-broadcast-second.
- `ticket.assignment_changed` is **never** emitted to customers.
- Typing: throttled `start` (≤1/2 s), auto-expiry after 4 s, ephemeral — never
  stored, never returned by REST. Customer-safe label only ("Requester is typing…").
- Reconnect with backoff and REST refetch on (re)connect; **8-second REST polling
  fallback** when the socket is unavailable (`useTicketRealtime.ts:36`).
- **Gap — notifications:** the in-app notification feed is agent-only, fetch-on-mount,
  with **no polling and no realtime delivery**. There is no push, no email, no SMS.
  The `emailed: boolean` on a notification is a **display marker only** — nothing
  is ever sent.

---

## Part C — OMS API integration

> **This is the section with the least existing contract and the most required
> work.** The Business+ mock order data is explicitly **not** the OMS
> integration. Nothing in this repository has ever called an OMS.

### C1. What OMS territory looks like in the codebase today

HeyQ currently has **two separate mocks** that both occupy OMS territory, with
**different shapes, different storage, and different maturity**. Unifying or
formally separating them is an open architectural decision.

| | Seam 1 — `orderProvider` | Seam 2 — `transactionService` |
|---|---|---|
| **Files** | `server/orderProvider.ts` + `src/app/services/orderProvider.ts` | `src/app/services/transactionService.ts` only |
| **Where it runs** | **Server-side** (migrated in M23/M24) | **Browser-side only** — never migrated |
| **Data source** | `server/seed.ts` → `store.businessPlusOrders` | Static import of `src/app/data/catalog.ts` |
| **Contract type** | `BusinessPlusOrderRecord` — thin (8 fields) | `RelatedTransaction` — rich (25 fields) |
| **Covers** | order id, tracking, shipment status, booking date, sender/recipient summaries, destination | + origin, pickup/delivery dates, latest movement, currency, shipping fee, charges[], payment method/status, COD amount, remittance status, exceptions[], dataSource, lastUpdatedAt |
| **Authorization** | Org-scoped, enforced server-side | Team-scoped via a client-side `transactionAccess` map |
| **HTTP surface** | 3 real routes exist | **None.** No `/transactions/*` route exists on the server |
| **Used by** | Order picker, ticket creation, agent `LinkedOrderPanel` | `TransactionPanel`, `NewTicket`, `overviewService`, `transactionRefresh` |

**The most important finding in this section:** `transactionService` — the seam
that carries payment, COD, remittance, charges, and exceptions — is still a
**browser-side module reading a static seed file**. It was left behind by the
M23/M24 server migration. Any OMS integration must first give it a server seam;
today there is nothing to put an adapter behind.

Documented plans exist: `docs/transaction-integration-plan.md` (M17, plan written)
and roadmap **M18** (production integration, **⏳ planned / blocked** on frontend
sign-off and backend technology selection).

### C2. Which HeyQ features require OMS data

| Feature | Surface | OMS data needed | Today |
|---|---|---|---|
| Order picker on the contact form | `OrderPicker.tsx` | Authorized order list + search | Business+ mock |
| Order authorization at ticket creation | `server/tickets.ts:186` | Single-order authorization check | Business+ mock |
| Linked-transaction snapshot on the ticket | `LinkedOrder.snapshot` | Status, booking date, route, summaries | Business+ mock |
| Agent "Check live status" | `LinkedOrderPanel.tsx:27` | Live order status by external id | Business+ mock |
| Agent transaction context panel | `TransactionPanel.tsx` | Full shipment + payment + remittance record | `catalog.ts` seed |
| Tracking-number lookup on internal ticket creation | `NewTicket.tsx` → `lookupByTracking` | Resolve tracking → transaction (0/1/many) | `catalog.ts` seed |
| Stale-snapshot background refresh | `transactionRefresh.ts`, `useStaleTransactionRefresh.ts` | Re-fetch by id | `catalog.ts` seed |
| Overview dashboard row context | `overviewService.ts` | Shipment status per row | `catalog.ts` seed |
| Queue/table tracking-number column + search | `ticketService.trackingNumberFor` | Tracking number only (from snapshot) | Snapshot / seed |

### C3. Direct call or via a backend?

**Recommendation, stated as an open decision for the OMS team to weigh in on:**
HeyQ's own API (`server/`) calls OMS server-to-server; the browser never does.

Grounds already in the codebase: the M23/M24 migration moved order authorization
server-side *specifically* because "order authorization has to be enforced here,
not in the browser, to be real" (`server/orderProvider.ts:4`); PII masking is
required at the boundary (`docs/product-rules.md` #15); and service credentials
cannot live in a Vite bundle, where `VITE_*` values are baked in at build time
and publicly readable.

**Open:** whether HeyQ calls OMS directly or through Business+ as an
intermediary. Today the embedded path implies Business+ has *already* talked to
OMS and passes results through (A4), while the contact-form path implies HeyQ
talks to the provider itself. Both cannot be the long-term answer.

### C4. Required OMS capabilities — assessed against the code

**Lookup**

| Capability | Needed by | Exists? |
|---|---|---|
| By tracking number | Internal ticket creation, agent search | Mocked client-side (`lookupByTracking`, substring match, 0/1/many) |
| By external order ID | Snapshot refresh, live status check | Mocked (`getAuthorizedOrder`, `getOrderForSupport`) |
| By customer / account | Order picker | Mocked (`listAuthorizedOrders`, org-scoped) |
| **Multiple IDs / tracking numbers (batch)** | Multi-transaction tickets, list views | **Does not exist.** Every consumer loops one-at-a-time. `transactionRefresh` only de-duplicates concurrent reads of the *same* id |

**Eligibility and authorization**

- Order eligibility validation before linking: **partially exists** — the contact-form
  path re-checks at creation and fails atomically; the embedded path does not check at all.
- Customer authorization ("may this requester see this order"): exists as an
  interface returning `forbidden`, backed by a same-org string comparison. Real
  ownership semantics (sub-accounts, delegated users, merchant hierarchies) are undefined.

**Order detail for the ticket snapshot** — HeyQ needs, at minimum:
`externalOrderId`, `trackingNumber`, `shipmentStatus`, `bookingDate`, and
optionally `destination`, `senderSummary`, `recipientSummary`, `serviceType`,
`deliverySummary`, `route`. HeyQ renders exactly what it is given.

**Live order status for agents** — exists as `getOrderForSupport(externalOrderId)`,
service-scoped, read-only, returning `ok | forbidden | not_found | unavailable`.

**Not built at all — no contract, no mock, no UI:**

- **Shipment history / status timeline / delivery events.** `RelatedTransaction`
  has `latestMovementAt` and an `exceptions[]` array, but **no event array**.
  There is no scan history anywhere in the codebase.
- **Pickup and delivery details** beyond `pickupDate` / `deliveryDate` scalars —
  no windows, no rider, no attempt records, no proof of delivery.
- **Merchant information** — no merchant entity exists in any model.
- **Sender / recipient** — masked display strings only (`senderMasked`,
  `recipientMasked`, e.g. `"No*** V***"`), by product rule #15. No addresses, no
  contact numbers.
- **Cancellation / return / claim flows** — `ShipmentStatus` includes `cancelled`
  and `returned`, and `TransactionException.type` includes `return` /
  `cancellation`, but there is no claim entity and no OMS action.

**Read vs. write:** HeyQ is **read-only against OMS today, by product rule.**
"HeyQ never mutates a shipment" and "no HeyQ action mutates a shipment" are
stated invariants (`docs/product-rules.md` #25). Whether HeyQ may *eventually*
request OMS actions (re-delivery, cancellation, claim filing) is an **open
product decision** — the current architecture forbids it and would need an
explicit rule change.

**Pagination / filtering / sorting / batch:** none exist anywhere in HeyQ, for
any resource. This must be designed, not retrofitted.

**Errors and fallback:** the discriminated result unions already model every
outcome the UI renders — `ok | forbidden | not_found | unavailable` for lookups,
`ok | unavailable` for lists, and `none | unavailable | permission_denied | found{stale}`
plus `invalid | multiple | found` for transactions. A real adapter only has to map
HTTP outcomes onto these. Degradation is already tested: provider down before
submission → picker degrades and the requester can still submit; provider errors
during submission → atomic failure with a clear message; provider down after
submission → the ticket renders from its snapshot with an explicit staleness notice.

**Rate limits, timeouts, retries, caching:** **none implemented.** There is no
HTTP client with a timeout, no retry, no circuit breaker, no cache. The only
related mechanism is in-flight de-duplication in `transactionRefresh.ts`.
`docs/transaction-integration-plan.md` proposes a read-through cache keyed on
`lastUpdatedAt` with a 48-hour staleness threshold and TTL-vs-events left open.

**Credentials, scopes, URLs, sandbox:** nothing exists. No OMS environment
variable, no base URL, no credential handling anywhere in the repo.

### C5. Assumptions HeyQ currently makes about OMS

Each of these is baked into working code and needs OMS confirmation or correction:

1. An order has **one stable external ID**, safe to store on a ticket indefinitely.
2. That ID and the **tracking number may be the same string** — the Business+
   handoff rows use `externalOrderId === trackingNumber` (`GGX-2026-90008`),
   with a comment that Business+'s stable order id *is* the tracking number.
3. Tracking numbers match `^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$` (product rule
   #21, enforced by `isTrackingNumber`). **The `GGX-2026-90008` handoff rows do
   not match this pattern** — the format rule and real GGX ids already disagree.
4. **Authorization is organisation-scoped** — one flat `externalOrgId` string
   comparison, no hierarchy, no per-user order permissions.
5. Shipment status maps onto exactly **nine** values (`booked`, `picked_up`,
   `in_transit`, `out_for_delivery`, `delivered`, `failed_delivery`, `returned`,
   `cancelled`, `on_hold`).
6. Payment status maps onto **four** values; remittance onto **four**.
7. **Shipment, payment, and remittance are three independent dimensions** that may
   legitimately disagree, and must never be collapsed into one status.
8. Sender/recipient arrive **already masked** — HeyQ does not mask, it displays.
9. A single composed record can be assembled from shipment + payment + remittance
   systems by the backend; **the frontend never fans out**.
10. Data older than **48 hours** is "stale" (mock threshold; per-status thresholds unresolved).
11. Currency is PHP and amounts are plain numbers (no minor units, no currency object).

### C6. Proposed OMS API checklist

| OMS Capability | Required By HeyQ | Current Substitute | Expected Endpoint or Contract | OMS Team Deliverable | Open Decision |
|---|---|---|---|---|---|
| Order lookup by tracking number | Internal ticket creation, agent tracking search | `transactionService.lookupByTracking` — substring match over `catalog.ts` | **TO BE DEFINED.** Must return 0 / 1 / many; "many" needs a disambiguation list (id, tracking, status, destination) | Endpoint + schema + partial-match semantics | Is partial/prefix matching supported, or exact-only? |
| Order lookup by external order ID | Snapshot refresh, agent live-status check | `orderProvider.getOrderForSupport` (server mock) | **TO BE DEFINED.** HeyQ proposal on file: `GET /internal/orders/:externalId` | Endpoint + schema + `not_found` vs `forbidden` distinction | Is the order ID the tracking number, or a separate identifier? |
| Orders by customer / account | Order picker, requester order list | `orderProvider.listAuthorizedOrders` (org-scoped) | **TO BE DEFINED.** HeyQ proposal: `GET /support/orders?query=` | Endpoint + scoping semantics + searchable fields | What is the account/org unit — merchant, contract, sub-account? |
| **Batch lookup (many ids / tracking numbers)** | Multi-transaction tickets, list rendering | **None** — N sequential calls | **TO BE DEFINED** | Batch endpoint, max batch size, partial-failure semantics | Batch vs. per-item; how are unauthorized entries reported? |
| Order eligibility validation before linking | Ticket creation | Contact-form path re-checks; embedded path trusts caller | **TO BE DEFINED** | A single-order "may this identity access this order" answer | Does OMS answer this, or Business+? (see A4) |
| Customer authorization / ownership check | Every requester-scoped read | Flat `externalOrgId ===` comparison | **TO BE DEFINED** | Authorization model incl. hierarchy and delegation | Org-only, or per-user and per-role? |
| Order detail for ticket snapshot | Every linked ticket | `BusinessPlusOrderRecord` (8 fields) | **TO BE DEFINED** | Field list OMS is willing to expose | Which of `serviceType` / `deliverySummary` / `route` are real OMS fields? |
| Live order status for agents | `LinkedOrderPanel` "Check live status" | `getOrderForSupport` mock | **TO BE DEFINED** | Endpoint + freshness guarantee | Is there a cheap status-only read, or is it the full record? |
| **Shipment history / status timeline / delivery events** | **Not built** — no UI, no model | **None** | **TO BE DEFINED** | Event schema: type, timestamp, location, actor, reason | Does HeyQ show a scan timeline at all? Product decision. |
| **Pickup and delivery details** | Partially — `pickupDate` / `deliveryDate` only | Seed scalars | **TO BE DEFINED** | Windows, attempts, proof of delivery, failure reasons | How much detail may support agents see? |
| Sender / recipient / merchant | Masked display strings only | Pre-masked seed strings | **TO BE DEFINED** | Masked display strings + the masking rule itself | Is there ever an audited full-PII unmask path? (`transaction-integration-plan.md` §4 leaves this open) |
| Payment / COD / remittance | Agent transaction panel | `catalog.ts` seed (`paymentStatus`, `codAmount`, `remittanceStatus`, `charges[]`) | **TO BE DEFINED** — likely *not* OMS; payments and remittance are named as separate GGX systems | Confirm ownership: OMS, Payments, or Remittance team | Who composes the three systems into one record — HeyQ's backend or an upstream service? |
| Cancellation / return / claim / exception info | Status values + `exceptions[]` exist; no claim entity | Seed `exceptions[]` | **TO BE DEFINED** | Exception/claim schema and lifecycle | Does HeyQ read claims, or does HeyQ *own* claims as tickets? |
| **OMS actions (write)** | **Forbidden today** by product rule #25 | n/a | **TO BE DEFINED if ever approved** | Action list + authorization + audit requirements | Will HeyQ ever request re-delivery / cancellation / claim filing? |
| Pagination / filtering / sorting | Needed by every list surface | **None anywhere in HeyQ** | **TO BE DEFINED** | Paging model (cursor or offset), sort keys, filter grammar | Cursor vs. offset; default and max page size |
| Error contract | All of the above | Discriminated unions already in place | **TO BE DEFINED** | HTTP status → error-code mapping | How is "exists but you may not see it" distinguished from "does not exist"? |
| Rate limits / quotas | Agent live checks, background refresh | **None** | **TO BE DEFINED** | Published limits + `429` semantics + retry-after | Per-service-account or per-end-user quota? |
| Auth / credentials / scopes | All of the above | **None** | **TO BE DEFINED** | Auth method (mTLS / OAuth client-credentials / API key), scopes, rotation | Service-to-service only, or user-context propagation? |
| Environments + sandbox | Development and staging work | **None** | **TO BE DEFINED** | Dev / staging / prod base URLs, test credentials, seeded sandbox data | Is there a sandbox with stable, resettable fixture orders? |
| Versioning + support | Long-term stability | n/a | **TO BE DEFINED** | Versioning policy, deprecation window, support/escalation contact | Is the contract versioned in the path, a header, or not at all? |

### C7. Exact deliverables required from the OMS team

1. **API documentation** for order read operations — resources, fields, types, nullability.
2. **Authentication method** and **service credentials** for dev and staging, with scopes and rotation policy.
3. **Base URLs** for development, staging, and production.
4. **Sample payloads** for a delivered order, an in-transit order, a failed
   delivery, a returned order, and a COD order — HeyQ needs these to build the
   adapter mapping.
5. **A sandbox** with stable, resettable fixture orders that HeyQ's tests can rely on.
6. **A decision on the ID model:** is `externalOrderId` the tracking number, and
   does the GGX tracking format rule (#21) hold for all real orders? (It already
   does not hold for the `GGX-2026-90008` handoff ids in the seed.)
7. **The authorization answer:** which system decides whether a requester may see
   an order — OMS, Business+, or both.
8. **The masking contract:** which fields are pre-masked, which are excluded
   entirely, and whether an audited unmask path is ever possible.
9. **Rate limits, timeouts, and SLA** for the endpoints HeyQ will call.
10. **Ownership and support commitment:** who owns the contract, how it is
    versioned, what the deprecation window is, and who to page.

---

## Part D — Other integration areas

### D1. Agent authentication and authorization
**Status: not implemented** (see A1). No SSO, no OAuth, no session, no server-side
role enforcement. `agentId` is a body parameter. **Requires:** Identity/Platform
team — IdP selection, SSO flow, token format, and a role/permission model the
server can enforce. The role taxonomy already exists in
`docs/roles-and-ui-permissions.md` and `src/app/lib/roles.ts` and is a good input.

### D2. Customer identity and session handling
**Status: mocked** (see B8). Requires the Business+ handoff decision plus a
verifiable session token. **Note:** CORS currently does **not** set
`Access-Control-Allow-Credentials`, so cookie-based cross-origin sessions will
not work as configured — a header-borne token is the path of least change.

### D3. Attachment upload and file storage
**Status: partially implemented.** Full upload/validation/authorization pipeline
exists; storage is an in-memory `Map`. **Requires:** Platform team — object
storage (S3 / GCS / Vercel Blob), malware scanning, retention policy, and a
signed-URL decision (today bytes stream through the API).

### D4. Real-time ticket updates and messaging
**Status: implemented** (see B9). The strongest integration in the repo.
**Requires:** a decision on multi-instance scaling — the subscription registry is
in-process, hence `numReplicas: 1`. A shared pub/sub (Redis, or Vercel Queues if
the API moves) is needed before scaling out.

### D5. Typing indicators
**Status: implemented.** Ephemeral, never stored, customer-safe labels only.
Contract in `docs/realtime-conversations.md`. No partner work required beyond
implementing the client side.

### D6. Notifications
**Status: partially implemented.** In-app, agent-only, fetch-on-mount, no polling
and no realtime push. Mute preferences and a 3-second dedup window exist.
**Not built:** customer notifications, browser push, mobile push, digests.

### D7. Email and other channels
**Status: not implemented.** No mail client, no ingestion, no threading, no
templates. `TicketSourceChannel` includes `'email'` and notifications carry an
`emailed` boolean, but **nothing is ever sent** — it is a display marker.
**Requires:** Platform/Comms team — ESP selection, inbound parsing and threading,
templates, suppression handling.

### D8. Database and persistent storage
**Status: not implemented** (see A2). **Requires:** a backend technology decision
that `docs/decision-log.md` records as deliberately deferred (D17/D25) and
`docs/session-state.md` names as a blocker for M18. This is the gating decision
for OMS work as well as for HeyQ's own durability.

### D9. Design system and shared frontend packages
**Status: vendored copy, not a shared package.** HeyQ copied GGX Corporate's
SHADCN primitives and the `tokens/tokens.json → scripts/build-tokens.mjs →
theme.css` pipeline, then **re-authored the primitives against semantic tokens**
because GGX's were light-only (decision M1.2). There is **no npm dependency** on
a GGX package — `package.json` has no `@ggx/*` entry. **Consequence:** upstream
GGX design-system changes do not propagate, and drift is guaranteed over time.
**Open:** QuadX brand red is still provisional (`#E11900`, open question A6)
pending Brand/Design sign-off.

### D10. API base URLs
| Piece | Local | Production |
|---|---|---|
| Frontend | `http://localhost:18020` (Vite, `strictPort`) | `https://heyq.vercel.app` |
| API | `http://localhost:4310` (via Vite `/api` proxy, `ws: true`) | e.g. `https://heyq-api-production.up.railway.app` |
| Realtime | same-origin, proxied | `wss://<api-origin>/api/realtime` |

`VITE_API_BASE_URL` is **build-time** — changing it requires a frontend rebuild,
and its value is public in the bundle. Never put a secret in a `VITE_*` variable.

### D11. CORS configuration
Defined in `server/http.ts:135-162`. Two origin classes:

- **Agent origins** (reach every route): `http://localhost:18020`,
  `https://heyq.vercel.app`, plus comma-separated `HEYQ_FRONTEND_ORIGIN`.
- **Customer origins** (reach `public` routes only): `http://localhost:18010`,
  `https://ggx-corporate.vercel.app`, plus comma-separated `HEYQ_BUSINESS_PLUS_ORIGIN`.

Allowed methods `GET, POST, PUT, PATCH, OPTIONS`; allowed headers
`Content-Type, X-Store-Id`; preflight cached 24 h; `Vary: Origin` set. No
`Allow-Credentials`. **Business+ must tell HeyQ its real production and preview
origins** so they can be added to `HEYQ_BUSINESS_PLUS_ORIGIN`.

**Note:** `X-Store-Id` selects which in-memory store a request operates on. It is
a test-isolation affordance (`server/store.ts`) that is currently accepted and
CORS-advertised in production.

### D12. Vercel and Railway deployment configuration
- **Vercel (frontend):** framework Vite, build `npm run build`, output `dist`,
  SPA rewrite `/(.*) → /index.html` in `vercel.json`. Project `heyq`
  (`prj_6y4Wf0AuDZOG7xqwkUmap63MahcA`). No `vercel.ts`. The Vercel CLI is not
  installed locally, so `vercel env pull` / `vercel deploy` are unavailable.
- **Railway (API):** NIXPACKS, no build step, `npm start` runs `tsx server/index.ts`,
  healthcheck `/health`, `restartPolicyType: ON_FAILURE`, **`numReplicas: 1`**
  (required — in-memory state + in-process socket registry).
- **Deployment order is load-bearing:** API first, obtain its origin, set
  `VITE_API_BASE_URL`, then build the frontend. Doing it in the other order bakes
  in an empty API origin and every `/api/*` call 404s.
- `.env.local` holds a `VERCEL_OIDC_TOKEN`; `.gitignore` covers `.env*`, so it is
  not committed. Verified.

### D13. Public / customer / agent / internal API boundaries
The boundary model is explicit and well-implemented **as an origin filter**, and
should not be mistaken for authorization.

- Default is `internal` — a new route is closed to customers until deliberately opened.
- `public` routes (the complete list): `GET /health`, `GET /customer/tickets`,
  `GET /customer/tickets/:id`, `POST /customer/tickets`,
  `GET /customer/tickets/:id/attachments`,
  `GET /customer/tickets/:id/attachments/:attachmentId`,
  `POST /customer/realtime/token`, `POST /tickets/:id/messages`,
  `POST /tickets/:id/reopen`.
- Everything else — agent workspace, order picker, portal token exchange,
  notifications, reports, audit, quality reviews — is `internal`.
- **Note the asymmetry:** `POST /tickets/:id/messages` and `POST /tickets/:id/reopen`
  are `public` but take **no identity parameter at all**, unlike the
  `/customer/*` reads. Ticket id alone is sufficient to reply to or reopen any
  ticket from a customer origin.

---

## Part E — Classification

### 1. Integrations already usable
| Integration | Note |
|---|---|
| Realtime channel (tokens, subscribe, events, typing) | Contract is production-shaped and documented; a client can be built against it today |
| Customer visibility policy | Server-enforced, correct, well-tested; the identity feeding it is the weak link |
| Customer ticket read surface (list, detail) | Works end to end; no pagination |
| Customer ticket creation from Business+ | Works end to end incl. multi-transaction and attachments |
| Conversation replies (both directions) | Works; internal-note isolation is structural |
| Attachment upload / validation / authorized download | Pipeline complete; storage is not durable |
| CORS + public/internal route split | Works as an origin filter |
| Vercel + Railway deployment | Deployed and documented; single-replica constraint |

### 2. Integrations currently mocked
| Integration | Mock location |
|---|---|
| Business+ order provider (list, lookup, support read) | `server/orderProvider.ts` over `server/seed.ts` |
| Business+ customer identity / session | `IdentityContext` simulated `businessPlus` block |
| OMS transaction context (payment, COD, remittance, exceptions) | `src/app/services/transactionService.ts` over `src/app/data/catalog.ts` — **browser-side, no server seam** |
| Tracking-number lookup | `lookupByTracking`, substring match over seed |
| Agent identity and roles | `IdentityContext` dropdown, UI-only gating |
| Requester portal secure link | `server/requester.ts` opaque token, no expiry or revocation |
| Email delivery | `emailed: boolean` display marker only |
| SLA timers | Fixed simulated clock anchored to 2026-07-14 |

### 3. Integrations partially implemented
| Integration | Built | Missing |
|---|---|---|
| Attachments | Upload, validation, authorization, download | Object storage, AV scanning, retention |
| Notifications | In-app agent feed, dedup, mute prefs | Polling/push, customer notifications, any external channel |
| Order authorization | Contact-form path re-verifies | Embedded Business+ path trusts the caller (A4) |
| Audit log | Ticket-derived entries, actor filter, search | Durable append-only storage |
| Quality reviews | Full internal workflow | No external surface (intentional) |
| Linked transactions | Creation, storage, display, search | No post-creation add/remove, no cap |

### 4. Integrations requiring another team's work
| Integration | Team | Blocking on |
|---|---|---|
| Business+ identity + authorized order lookup | GGX Business+ | Implementing the provider contract; a verifiable session token |
| Business+ handoff deep link | GGX Business+ | Replacing the simulated session with signed context |
| Business+ consumption of the customer API | GGX Business+ | Swapping their local HeyQ mock for real HTTP calls (per `docs/session-state.md`) |
| **All OMS endpoints** | OMS | Everything in Part C — no contract exists |
| Payments / remittance data | Payments + Remittance (ownership unconfirmed) | Whether these are OMS or separate systems |
| Agent SSO | Identity / Platform | IdP and token format selection |
| Database | Platform + HeyQ | Backend technology decision (deferred as D17/D25) |
| Object storage + AV scanning | Platform | Provider selection |
| Email channel | Platform / Comms | ESP selection, inbound parsing |
| Design system alignment | Design System / Brand | Shared package vs. vendored fork; final QuadX red (A6) |

### 5. Future integrations implied by the architecture but not yet built
- **OMS write actions** — re-delivery, cancellation, claim filing. Currently
  forbidden by product rule #25; would need an explicit rule change.
- **Shipment event timeline** — implied by `latestMovementAt` and `exceptions[]`,
  but no event model or UI exists.
- **Audited PII unmask path** — raised as an open item in
  `docs/transaction-integration-plan.md` §4; deliberately not built.
- **Webhooks from Business+ / OMS into HeyQ** — the plan mentions event-driven
  cache invalidation as an alternative to TTL; no receiver exists.
- **Multi-brand tenancy** — `brandId` is on every model; brand switching is
  disabled UI only, by product rule #9.
- **Zendesk data migration** — explicitly optional and out of scope; imported
  records would become native HeyQ records.
- **Search infrastructure** — all search is client-side or in-memory substring matching.
- **Multi-instance scaling** — requires shared pub/sub and shared state.

---

## Summary table

| Integration | Owning Team | HeyQ Status | What the Other Team Must Provide | Blockers / Decisions |
|---|---|---|---|---|
| Business+ ticket creation (embedded) | GGX Business+ | Implemented, unconsumed | Call `POST /api/customer/tickets`; stable external IDs; concern-type mapping | Trusted vs. verified linking (A4); no auth (A1); no idempotency key |
| Business+ ticket list / detail | GGX Business+ | Implemented | Call `GET /api/customer/tickets[/:id]`; their production + preview origins for CORS | No pagination or filtering; identity is a query parameter |
| Business+ linked transactions | GGX Business+ | Implemented | Pre-authorized `LinkedOrder[]`, primary first; confirm the snapshot field set | Max transactions per ticket; post-creation edits |
| Business+ customer identity | GGX Business+ + Identity | **Mocked** | Verifiable session token resolving to `externalUserId` / `externalOrgId`; ID stability guarantee | No session format chosen; no `Allow-Credentials` in CORS |
| Business+ handoff deep link | GGX Business+ | Mocked (`/contact?order=`) | Signed session context on the link | Authorization behaviour is final; the session is not |
| Customer replies / reopen | GGX Business+ | Implemented | Call the public routes | **These two routes take no identity at all** — ticket id is sufficient |
| Attachments | GGX Business+ + Platform | Partial (in-memory) | Business+: multipart client. Platform: object storage + AV | No durable storage; no scanning; no retention policy |
| Realtime + typing | GGX Business+ | Implemented | Implement the client per `docs/realtime-conversations.md` | Single replica only; needs shared pub/sub to scale |
| **OMS order lookup (tracking / id / account)** | **OMS** | **Mocked behind two seams** | Endpoints, schemas, auth, base URLs, sandbox, sample payloads | **No contract exists.** Direct vs. via-Business+ call path unresolved |
| **OMS batch lookup** | **OMS** | **Not built** | Batch endpoint, max size, partial-failure semantics | Whether batch is offered at all |
| **OMS order eligibility + ownership check** | **OMS** (or Business+) | Split — one path checks, one trusts | A single authoritative "may this identity access this order" answer | Who owns the answer (A4); org-only vs. per-user scoping |
| **OMS live status for agents** | **OMS** | Mocked | Status-only read + freshness guarantee | Rate limits for agent-triggered checks |
| **OMS shipment history / delivery events** | **OMS** | **Not built — no model, no UI** | Event schema | Does HeyQ show a timeline at all? Product decision |
| **OMS pickup / delivery detail** | **OMS** | Two scalar dates only | Windows, attempts, proof of delivery, failure reasons | How much detail agents may see |
| **Payment / COD / remittance** | Payments + Remittance (unconfirmed) | Mocked client-side | Confirm system ownership; composition responsibility | Named as separate GGX systems, not OMS; who composes them |
| **OMS write actions** | **OMS** | Forbidden by product rule | n/a until approved | Will HeyQ ever request OMS actions? |
| Agent SSO / authorization | Identity / Platform | **Not implemented** | IdP, SSO flow, token format, enforceable permission model | Nothing decided; role taxonomy already documented |
| Requester portal tokens | HeyQ | Mocked | n/a | No expiry, revocation, or rotation |
| Notifications | Platform | Partial (in-app, agent-only) | Push/email delivery infrastructure | No customer notifications at all |
| Email channel | Platform / Comms | **Not implemented** | ESP, inbound parsing, threading, templates | `emailed` is a display marker only |
| Database | Platform + HeyQ | **Not implemented** | Backend technology decision, then schema and migrations | Deferred as D17/D25; gates M18 and OMS work |
| Design system | Design System / Brand | Vendored fork | Shared package decision; final QuadX red (A6) | No npm dependency — drift is guaranteed |
| CORS / origins | GGX Business+ + Platform | Implemented | Real production and preview origins | `X-Store-Id` and `/_test/*` routes exposed in production |
| Vercel + Railway deployment | Platform | Implemented | Durable API host once state moves to a database | `numReplicas: 1` is a hard constraint today |

---

### Recommended first three actions

1. **Resolve authentication (A1) before anything else.** Every other integration's
   authorization story is downstream of it, and both partner teams need the answer
   before they can build.
2. **Get an OMS contract conversation started with Part C in hand.** HeyQ has no
   OMS contract at all, and `transactionService` — the seam carrying payment, COD,
   and remittance — has no server presence to put an adapter behind.
3. **Decide A4 — trusted vs. verified order linking.** It determines whether OMS
   integration is HeyQ's work, Business+'s work, or both.
