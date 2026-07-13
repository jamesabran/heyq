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
