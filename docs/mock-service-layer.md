# Mock Service Layer

The **single integration seam** between the frontend and a future real API.
Modeled on GGX Corporate's `src/app/services/*` pattern. Derived from §7 / §9b.

## Pattern

- **Async service facades over typed module-state seed data.** Components call
  services; services read/write `data/*` (in-memory module state, optionally
  persisted to `localStorage` for demo continuity). Services return Promises so
  latency/loading/error states exist from day one.
- **Components never import seed files directly** — always through a service.
- Each service **documents its intended future REST/RPC endpoints** in a doc
  comment (as GGX services do), so the mock→real swap is mechanical and local.
- **IDs are opaque strings**; filtering/sorting/search run client-side over the
  in-memory dataset.

Example (shape mirrors GGX's `slaService`):

```ts
/**
 * ticketsService — ticket read/write facade.
 * Future API endpoints:
 *   GET  /tickets?filters          → listTickets
 *   GET  /tickets/:id              → getTicket
 *   POST /tickets                  → createTicket
 *   POST /tickets/:id/messages     → addMessage
 *   POST /tickets/:id/notes        → addInternalNote
 *   POST /tickets/:id/escalate     → escalate
 *   POST /tickets/:id/assign       → assign
 */
export async function listTickets(f?: TicketFilters): Promise<Ticket[]> { … }
```

## Query / mutation hook layer

A **thin query/mutation hook layer** wraps the services so components are
isolated from the data source and the eventual swap to `fetch` is localized.
This is the one deliberate seam GGX lacks (GGX calls services directly). It is a
frontend convenience only — **no server, no DI, no repository pattern.** Prefer
a small library (e.g. TanStack Query) *or* a thin in-house `useQuery`/`useMutation`
wrapper; decide in Milestone 2 when the first real reads land (M1 does not need
it). See [`decision-log.md`](decision-log.md).

## Planned services (built across milestones)

| Service | Owns | Milestone |
|---|---|---|
| `kbService` | Articles, categories, revisions, publish/visibility | 3, 7 |
| `ticketsService` | Tickets, messages, notes, status, assignment, escalation | 4, 5, 6 |
| `requesterService` | Requester records, portal token resolution | 4 |
| `routingService` | Concern → team/tier rules | 6, 8 |
| `slaService` | SLA policies, simulated clock events (see sla doc) | 5, 8 |
| `agentAdminService` | Agents, teams, queues, tiers, taxonomy | 8 |
| `notificationService` | In-app feed + "email sent" markers, prefs | 9 |
| `reportsService` | Operational counters + chart data | 9 |
| `auditService` | Simulated append-only activity feed | 5+ |

## Seam discipline (why this matters)

A real backend must slot in **behind these facades without frontend redesign**:

- Typed contracts from the shared `models` module (see
  [`mock-data-model.md`](mock-data-model.md)); mock data conforms to them.
- Services are the **only** place that knows data is mocked.
- Async everywhere; opaque IDs; `brand` field present where it prevents rework.
- Simulated "system actions" (routing, acknowledgements, notifications) fire
  synchronously **inside the mock layer** and appear on timelines/feeds — a
  demo stand-in for future backend-emitted events.

**Not built:** microservices, event bus, dependency injection, repository
pattern, generic workflow/rules engine. Workflow transitions are plain
TypeScript functions.

## Phase 2 service additions (planned — M13–M18)

New seams built once Phase 2 lands (see [`roadmap.md`](roadmap.md) and §21). Each
stays a typed async facade; GGX systems are an **integration behind the seam,
never a runtime foundation** (§17). No component/hook redesign is required.

- **`transactionService` (M13, backed by mock; M17/M18 backed by real GGX).**
  Resolves a tracking number / transaction ID to a `RelatedTransaction` and
  exposes a manual refresh. Models the invalid/unmatched, unavailable, stale,
  permission/ownership-mismatch, and multiple-match outcomes. Sender/recipient
  are masked at this boundary (product rule #15).

  ```ts
  /**
   * transactionService — GGX transaction context facade.
   * Future API endpoints (M17/M18):
   *   GET /transactions/lookup?tracking=      → lookupByTracking (0/1/many)
   *   GET /transactions/:id                    → getTransaction
   *   POST /transactions/:id/refresh           → refresh (re-fetch live)
   */
  export async function lookupByTracking(t: string): Promise<TransactionMatch>;
  ```

- **`ticketService.createInternalTicket` (M16).** Creates a ticket with
  `source: 'internal'`, a `reporterId`, optional external requester,
  `concernType`, classification, priority, team/assignee, optional
  `relatedTransactionId`, internal notes, and attachments — recording the creator
  in the timeline/audit. `requesterNotificationsEnabled` defaults **false** for
  internal tickets (rules 17–18). Same model, same seven-status lifecycle — **no
  separate service or entity** for internal reports.
  Future endpoint: `POST /tickets` (with `source=internal`).

Planned-services table gains one row:

| Service | Owns | Milestone |
|---|---|---|
| `transactionService` | Tracking→transaction lookup, refresh, masking, states | 13 (mock), 17–18 (real) |

`concernType` is handled by the existing `ticketService`/`adminService` (a new
controlled field, not a new service).

- **Overview dashboard (M19) — no new data source.** The role-based Overview is
  **composed from existing services**: `reportsService.getSummary(teamId?)` for
  scoped counters, `ticketService.listTickets({queue, viewerId, viewerTeamId,
  status, sort, search})` for the attention lists, and `slaService` /
  `transactionService` for row context. If any aggregation is warranted, add a
  **thin role-aware read** (e.g. `reportsService.getOverview(identity)` or a small
  `overviewService`) that only calls the services above and returns existing view
  models — **no new entity, no new persistence, no widget/DI/config layer**
  (product rule #19; guardrail D18). Future endpoint, if introduced:
  `GET /overview?scope=` — otherwise the dashboard just calls the existing
  endpoints and assembles client-side.
