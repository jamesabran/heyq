# Roadmap

Twelve frontend-first milestones for the MVP (**all done**), followed by a
**Post-MVP Phase 2** (M13–M18, planned — not started). Sizing S/M/L is
**relative effort**, not calendar time. Only **Milestone 1** has a detailed
implementation plan (below); the rest are concise, implementation-sized entries.
Derived from §13 and §21 of the source-of-truth plan.

Milestones 1–3 can begin immediately. Taxonomy, SLA placeholder targets, and the
QuadX red value (see [`session-state.md`](session-state.md)) feed milestones 3–9
but do **not** block foundation work.

**Phase 2 (M13–M18) is gated on MVP acceptance** — see
[Post-MVP Phase 2](#post-mvp-phase-2--next-phase-enhancements-m13m18) below.

---

## Milestone summary

| # | Milestone | Complexity | Depends on |
|---|---|---|---|
| 1 | Foundation & QuadX theme ✅ **done** | M | — |
| 2 | App shell, navigation & simulated roles ✅ **done** | M | 1 |
| 3 | Public help center & article experience ✅ **done** | M | 2 |
| 4 | Ticket submission & requester portal ✅ **done** | L | 3 |
| 5 | Agent ticket list & detail workspace ✅ **done** | L | 4 |
| 6 | Classification, assignment & escalation ✅ **done** | M | 5 |
| 7 | Knowledge-base administration ✅ **done** | M | 3 |
| 8 | Agent, team, queue & taxonomy administration ✅ **done** | M | 6 |
| 9 | Simulated notifications & reporting ✅ **done** | M | 6 |
| 10 | State coverage ✅ **done** | S–M | 3–9 |
| 11 | Light/dark, responsive, a11y & interaction QA ✅ **done** | M | 1–10 |
| 12 | Frontend approval & backend-readiness assessment ✅ **done** | S | 1–11 |

### Post-MVP Phase 2 (planned — gated on MVP acceptance)

| # | Milestone | Complexity | Depends on |
|---|---|---|---|
| 13 | GGX sample data & transaction-context prototype ✅ **built** | L | MVP accepted |
| 14 | Theme & visual-hierarchy refinement ✅ **built** | M | MVP accepted |
| 15 | Concern Type visibility in ticket queues ✅ **built** | S–M | MVP accepted |
| 16 | Internal ticket creation ✅ **built** | M | 15 |
| 17 | Backend transaction lookup & synchronization planning ✅ **plan written** | M | 13, backend gate |
| 18 | Production integration — GGX transaction / payment / remittance ⏳ **planned** | L | 17 |
| 19 | Role-based Overview dashboard (default landing) ✅ **built** | M | 13, 15, 16 |
| 20 | Audit log viewer ✅ **built** | S–M | 6, 7 |
| 21 | GGX tracking numbers, simplified states & badge hierarchy ✅ **built** | M | 13, 15, 19 |
| 22 | GGX Business+ integration — HeyQ side (mock provider) ✅ **built** | M–L | 13, 21 |

> **Note:** M13–M16 and M19 are frontend/mock work and have been **built ahead of
> formal MVP sign-off** (all gates green — see as-built notes below). They remain
> feature-flagged conceptually behind acceptance; M17–M18 are backend
> planning/integration and stay **planned** (no backend exists to build against).

---

## M2 — App shell, navigation & simulated roles (M) — ✅ **done**

- **Objective:** A navigable shell whose visible nav/views change by simulated role.
- **Included:** Full route tree (§4/[IA](information-architecture.md)); public +
  authenticated (`/app`, `/admin`) layouts; simulated identity switcher
  (7 role/tier/team demo identities, persisted); role-based nav gating +
  `RequireRole` route guards driven by shared role groupings.
- **Exclusions:** No help-center/ticket/admin *content* screens (placeholders only).
- **Dependencies:** M1.
- **Acceptance:** ✅ Every area reachable; switching identity changes visible nav
  and gated routes per the role matrix. Verified in-browser + 15 tests.
- **Complexity:** M.
- **As-built notes:** Query/mutation layer **deferred** — resolves D10 by decision
  (thin in-house wrapper) but not implemented, since M2 has no data reads (built
  in M3 when the first `kbService` read lands). `/` and `/*` redirect to `/app`;
  `/admin` redirects to `/admin/kb`. Route params surface on the placeholder to
  prove dynamic routing.

## M3 — Public help center & article experience (M) — ✅ **done**

- **Objective:** The KB reading experience for guests.
- **Included:** Help home (search, featured, categories), category/subcategory
  listing, article view (related, last-updated, breadcrumb), search results;
  mock KB data via `kbService`. First `useQuery` (thin query wrapper, D10/M2.1).
- **Exclusions:** KB authoring/publish (M7); ticket intake (M4).
- **Dependencies:** M2.
- **Acceptance:** ✅ A guest browses categories, searches, and opens an article
  with related links + last-updated. Internal/draft articles never surface
  publicly. Covered by 14 tests (9 service + 5 page).
- **Complexity:** M.
- **As-built notes:** KB types in `models/kb.ts`; seed in `data/kb.ts` (incl. one
  internal + one draft article to prove filtering); `kbService` filters to
  published+public in one place; `useQuery` read-only hook (no `useMutation` yet —
  no writes until M4). Dependency-free `ArticleBody` renderer (`## `/`- `/`**` `).

## M4 — Ticket submission & requester portal (L) — ✅ **done**

- **Objective:** Intake + requester tracking end-to-end.
- **Included:** Progressive web form (concern drives conditional fields);
  simulated transaction-prefill (read-only known fields); reference +
  confirmation; requester portal at `/t/:token` (status, thread, reply, reopen);
  `requesterService` token resolution. Adds `useMutation`.
- **Exclusions:** Real tokens/auth; agent-side workspace (M5).
- **Dependencies:** M3.
- **Acceptance:** ✅ A guest submits and tracks a ticket end-to-end; the ticket
  lands in the correct team's unassigned queue (New→Open, unassigned); the portal
  opens only via access token, never by reference. Covered by 12 tests + browser
  spot-check (portal render, transaction prefill).
- **Complexity:** L.
- **As-built notes:** Ticket/support models + seed (`data/tickets.ts`,
  `data/catalog.ts`); `catalogService` (teams/taxonomy/transactions),
  `ticketService` (create/reply/reopen, mutates module state), `requesterService`
  (token→portal). Routing = category `defaultTeamId` (rule overrides deferred to
  M6). Reply moves Pending Requester→In Progress and Resolved→Reopened. Attachments
  are metadata-only (no upload). Added `ui/Select`, `ui/Textarea`.

## M5 — Agent ticket list & detail workspace (L) — ✅ **done**

- **Objective:** The core agent surface.
- **Included:** Queues (mine/team/unassigned/escalated/SLA), filters/sort, 3-pane
  detail (context | conversation | actions), public reply, internal note,
  resolve; ticket timeline; simulated SLA states + simulated clock; audit events.
- **Exclusions:** Assignment/escalation *controls* (M6); admin config (M8).
- **Dependencies:** M4.
- **Acceptance:** ✅ An agent works a ticket to resolution; internal notes are
  visibly distinct and never appear in the portal (browser-verified); SLA badges
  reflect the simulated clock. 11 tests + browser check.
- **Complexity:** L.
- **As-built notes:** `InternalNote` type + `slaService` (targets 4h/48h vs a
  fixed simulated clock, resolution pauses on Pending Requester) + `lib/clock.ts`.
  Expanded ticket seed (8 tickets across queues/SLA states, internal notes,
  status events). Queues share `AgentQueuePage` scoped by identity; 3-pane
  `TicketDetail`; `TicketTable`, `AgentConversation`, `TicketComposer`, badges.
  Aligned identity `teamId`s to catalog team ids. SLA business-hours accuracy and
  policy config deferred to M8.

## M6 — Classification, assignment & escalation (M) — ✅ **done**

- **Objective:** Triage interactions.
- **Included:** Classification controls; rules→team routing (category
  `defaultTeamId`, re-route on category change); manual claim/reassign/unassign;
  **L1→L2 escalation** with mandatory reason + note and escalation history — as a
  separate `escalationState`/tier/team/owner change, **not a status change**.
- **Exclusions:** Round-robin/workload routing (deferred).
- **Dependencies:** M5.
- **Acceptance:** ✅ A ticket routes, is assignable, and escalates with history;
  the Escalated view filters by escalation state, not status; status stays
  `In Progress` through escalation (browser-verified). 8 tests.
- **Complexity:** M.
- **As-built notes:** `Assignment` + `Escalation` history types & seed;
  `ticketService` gains `claimTicket`/`assignTicket`/`reclassifyTicket`/
  `escalateTicket`/`deescalateTicket`; timeline now merges status + assignment +
  escalation. `TicketActions` right-pane panels; `catalogService.listAgents`.
  Escalation takes a target team/owner (no fixed L2-team model).

## M7 — Knowledge-base administration (M) — ✅ **done**

- **Objective:** KB authoring.
- **Included:** Article list, draft/publish, categories, ordering, revisions,
  public/internal visibility.
- **Exclusions:** Public reading UI (M3).
- **Dependencies:** M3.
- **Acceptance:** ✅ An editor drafts, revises, sets visibility, and publishes;
  the article appears publicly; internal-only articles never appear publicly
  (enforced in `kbService` public reads). 7 tests + browser check.
- **Complexity:** M.
- **As-built notes:** `KbRevision` type + seed; `kbService` gains admin reads
  (`listAllArticles`/`getArticleForEdit`/`listAllCategories`) and writes
  (`createArticle`/`updateArticle` w/ revision snapshot / `publishArticle` /
  `unpublishArticle` / `setArticleVisibility` / `listRevisions`). Nested
  `/admin/kb` routes (list / new / :id) with `KbAdminList` + `KbArticleEditor`.
  Category CRUD deferred (taxonomy admin is M8).

## M8 — Agent, team, queue & taxonomy administration (M) — ✅ **done**

- **Objective:** Admin surfaces.
- **Included:** Agent enrollment/roles/tiers/activation, teams/queues, routing
  rules, SLA policies + business hours, concern taxonomy — all simulated config.
- **Exclusions:** Real identity/permission enforcement.
- **Dependencies:** M6.
- **Acceptance:** ✅ An admin configures agents, teams, routing, SLA, and
  taxonomy; changes reflect downstream (routing → submission team; SLA config →
  badges — both proven by tests). 8 tests.
- **Complexity:** M.
- **As-built notes:** `adminService` writes (agent active/tier, add team, add
  category/subcategory, set routing team, get/update SLA config); `slaConfig`
  now drives `slaService`; agents gain `active`. Pages: Agents, Teams, Routing,
  SLA, Categories. `/admin/settings` + `/admin/audit` remain light placeholders
  (audit viewer belongs with M9). Category rename/delete deferred (add + reassign
  cover the acceptance).

## M9 — Simulated notifications & reporting (M) — ✅ **done**

- **Objective:** Feedback + operational visibility.
- **Included:** In-app notification feed + "email sent" markers + prefs/dedup
  (`notificationService`); operational dashboard — counters + simple charts
  (`reportsService`).
- **Exclusions:** Analytics platform; real delivery.
- **Dependencies:** M6.
- **Acceptance:** ✅ Core events produce one in-app notification (deduped; muted
  events suppressed) with an "email sent" marker where applicable; the dashboard
  reflects the mock dataset (browser-verified: 8 total, 1 escalated, 2 breached).
  10 tests.
- **Complexity:** M.
- **As-built notes:** `Notification` model + seed; `notificationService`
  (`emit` with dedup + mute prefs, list/unread/markRead/markAllRead) called from
  ticketService actions; header `NotificationBell` + `/app/notifications` feed +
  nav item. `reportsService.getSummary(teamId?)`; shared `Dashboard` for
  `/app/reports` (all) and `/app/supervisor` (team). **Charts are dependency-free
  CSS bars** (see decision M9.2) — no Recharts added.

## M10 — State coverage (S–M) — ✅ **done**

- **Objective:** Robust empty/loading/success/error/validation states.
- **Included:** Every list/detail/form gets defined states across the app.
- **Exclusions:** New features.
- **Dependencies:** M3–M9.
- **Acceptance:** ✅ Every data view has loading (skeletons), empty/not-found,
  and **error + retry** states; forms have validation + success. 2 tests.
- **Complexity:** S–M.
- **As-built notes:** Added a reusable `ErrorState` (retry via `useQuery.refetch`)
  and wired the previously-missing error branch into every query-backed page
  (help home/category/article/search, agent queues, ticket detail, requester
  portal, dashboard, notifications, KB admin). Loading/empty/validation/success
  already existed from M3–M9.

## M11 — Light/dark, responsive, accessibility & interaction QA (M) — ✅ **done**

- **Objective:** Polish & QA.
- **Included:** Dual-mode audit, responsive breakpoints, keyboard/focus/
  screen-reader passes, per-role review pass, interaction QA.
- **Exclusions:** New features.
- **Dependencies:** M1–M10.
- **Acceptance:** ✅ Token audit (only an intentional modal scrim is non-token, so
  dark mode is complete); browser-verified dark + mobile (375px) with **no
  horizontal overflow** on the widest views; skip link + `main` landmark +
  `aria-expanded` nav toggle + Escape-closes-sidebar. Per-role gating and
  interactions covered by the suite. 3 a11y tests.
- **Complexity:** M.

## M12 — Frontend approval & backend-readiness assessment (S) — ✅ **done**

- **Objective:** Gate to backend planning.
- **Included:** Stakeholder review; document the API contracts/seams; backend
  productionization readiness note (technology still unselected).
- **Exclusions:** Any backend build.
- **Dependencies:** M1–M11.
- **Acceptance:** ✅ [`backend-readiness.md`](backend-readiness.md) inventories the
  service seams, endpoints, typed contracts, simulated→production gaps, and
  standalone/Zendesk-independence; awaits stakeholder sign-off (the only
  remaining item — a decision, not a build).
- **Complexity:** S.

---

# Post-MVP Phase 2 — next-phase enhancements (M13–M18)

**Gated on MVP acceptance.** These milestones extend the accepted prototype and
stage the first real GGX data path. Items M13–M16 are frontend/mock work; M17–M18
are backend planning/integration and depend on the backend-readiness gate (M12).
Full narrative in §21 of the
[source-of-truth plan](quadx-helpdesk-first-pass-plan.md#21-post-mvp-phase-2--next-phase-enhancements-planned-not-built).
Every architectural rule (standalone platform; GGX as integration not runtime
foundation; typed async services; escalation ≠ status; internal notes never in
requester views; no needless abstractions/dependencies) is preserved.

## M13 — GGX sample data & transaction-context prototype (L) — ✅ **built**

- **Objective:** Show GGX transaction details inline in the agent ticket view so
  agents rarely need to open a separate GGX system.
- **Included:** Expand `RelatedTransaction` (see
  [`mock-data-model.md`](mock-data-model.md)) with tracking number, shipment/
  delivery status, origin/destination, **masked** sender/recipient, booking/
  pickup/delivery/latest-movement dates, shipping fee + charges, payment method,
  payment status, COD amount + remittance status, exceptions/failed-attempts/
  returns/cancellation, **data source + last-updated timestamp**. Render them in
  the left context pane. Link via: report-from-transaction, contact-form tracking
  number, agent manual entry/search, or integration-supplied transaction ID —
  stored as **structured ticket context**, not description text. Realistic GGX
  seed data + the ten seeded scenarios (§21.1). Simulated states: loading,
  invalid/unmatched tracking number, transaction unavailable, stale data, manual
  refresh, permission/ownership mismatch, multiple matches.
- **Exclusions:** Any real GGX/OMS call (M17/M18); persistence.
- **Dependencies:** MVP accepted.
- **Acceptance:** A ticket linked to a transaction shows the full detail set with
  masking, data source, and last-updated; ticket, shipment, and payment/
  remittance statuses are **independent** (changing ticket status never changes
  the others); all listed states render from mock data; the ten scenarios are
  demonstrable.
- **Complexity:** L.
- **As-built notes:** Expanded `RelatedTransaction` (shipment/payment/remittance
  enums, masked sender/recipient, dates, fees/charges, COD, exceptions, data
  source + `lastUpdatedAt`); `transactionService` returns discriminated results
  (`none`/`unavailable`/`permission_denied`/`found` + `stale`) plus
  `lookupByTracking` (`invalid`/`multiple`/`found`); ownership via
  `transactionAccess` map (owning team + admin can view). `TransactionPanel` in
  the detail left pane renders all states, a manual **Refresh**, and a
  tracking-lookup that links via `ticketService.linkTransaction` (structured
  context). 11 seeded transactions cover all ten scenarios across tickets
  `tkt-seed-1/2/3/6/7` + new `tkt-seed-9…14`. Shipment/payment/remittance badges
  spread across the palette. 8 service tests.

## M14 — Theme & visual-hierarchy refinement (M) — ✅ **built**

- **Objective:** Replace the too-bright provisional red with a calmer, more
  hierarchical palette while keeping red as a recognizable GGX accent.
- **Included:** Theme review (see
  [`design-system-strategy.md`](design-system-strategy.md)): test a darker/less
  saturated primary red (possible burgundy direction); add a **secondary accent**
  (blue or teal) for standard actions, links, selected states, and informational
  elements; neutral surfaces/nav/tables/controls; reserve strong red for errors,
  destructive actions, urgent SLA breaches, and critical exceptions; broaden the
  status palette so delivery/payment/ticket/SLA statuses **don't all rely on
  red**. Token-layer only — no component fork.
- **Exclusions:** Component rewrites; new UI library.
- **Dependencies:** MVP accepted (independent of M13/M15/M16).
- **Acceptance:** Fewer simultaneous red elements; strong red reserved for
  errors/destructive/critical; a secondary accent carries ordinary actions;
  statuses read by more than color/red; contrast, dark mode, accessibility, and
  visual hierarchy validated before the palette is finalized (final shade remains
  provisional until reviewed visually, A6).
- **Complexity:** M.
- **As-built notes:** Token-layer only. Primary → deep **burgundy** (`#9E1B2E`
  light / `#B5273A` dark), distinct from `destructive` (`#d4183d`, reserved for
  errors). New **teal `accent-brand`** token pair (`#0f766e` / `#2dd4bf`) drives
  selected nav + standard table links; brand red stays on primary buttons/brand
  chip only. Status badges already spread across success/warning/info/destructive
  so statuses don't all rely on red. `theme.css` regenerated; sync guard passes;
  tokens test asserts the new accent. Final shade provisional (A6).

## M15 — Concern Type visibility in ticket queues (S–M) — ✅ **built**

- **Objective:** Let agents grasp and prioritize the issue before opening a
  ticket.
- **Included:** New **`concernType`** field (controlled list: Delivery delay,
  Pickup issue, Missing parcel, Damaged parcel, COD concern, Remittance concern,
  Payment issue, Booking issue, Address correction, Account concern, General
  inquiry). Visible **Concern Type column** in agent ticket tables. Realistic
  seed values. Responsive: on small screens it may appear in the primary ticket
  summary rather than being hidden.
- **Exclusions:** Merging it with category/subcategory/status/priority/
  escalation/team (it stays a **separate** field).
- **Dependencies:** MVP accepted.
- **Acceptance:** Concern Type is a distinct field (product rule), shows as a
  column at desktop width and in the ticket summary at mobile width, and carries
  understandable seeded values across the queues.
- **Complexity:** S–M.
- **As-built notes:** New `concernType` field + `ConcernType` enum/labels;
  seeded on all tickets; derived by category on public create; editable via the
  classification controls (separate `Select`). `ConcernTypeBadge` (neutral
  outline). Table shows a **Concern Type column** at `md+` and folds it into the
  subject summary below `md`. Shown in the detail classification card. Tests in
  `ticketService`/`escalation` specs.

## M16 — Internal ticket creation (M) — ✅ **built**

- **Objective:** Let agents create tickets for concerns that don't arrive through
  the requester form.
- **Included:** **Add Ticket / New Ticket** action on the agent ticket list. A
  creation flow capturing: source (incl. `Internal`), reporter/submitting
  employee, requester details (when external), Concern Type, category/subcategory,
  description, priority, team/assignee, optional tracking number / GGX
  transaction link, internal notes, attachments, and audit history of who created
  it. Same native ticket model + seven-status lifecycle; a different `source` and
  communication configuration — **no separate model**. Requester notifications
  **off by default** for purely internal tickets; if an external requester is
  added, the agent explicitly chooses whether requester communication is enabled.
- **Exclusions:** A parallel internal-ticket data model; real notification
  delivery.
- **Dependencies:** M15 (Concern Type is a creation field).
- **Acceptance:** An agent creates an internal ticket that follows the standard
  lifecycle, records the creator in audit history, sends **no** requester
  notification by default, and — only when an external requester is added and
  communication is explicitly enabled — surfaces requester-facing messaging.
- **Complexity:** M.
- **As-built notes:** `Ticket` gains `reporterId` + `requesterNotificationsEnabled`;
  `ticketService.createInternalTicket` (source `internal`, synth internal
  requester when no external customer, creator in audit, optional assignee/note/
  tracking-link). `requesterNotificationsOn` gates the "emailed to requester"
  markers in reply/resolve. `NewTicket` page at `/app/tickets/new` (static route
  before `:id`); **New ticket** action on My Queue / Team / Unassigned. Detail
  shows the notifications state for internal tickets. 3 service tests.

## M17 — Backend transaction lookup & synchronization planning (M) — ✅ **plan written**

- **Objective:** Plan (not build) the first real GGX data path behind the
  existing service seam.
- **Included:** Design how a backend resolves a tracking number / transaction ID
  to live transaction, payment, and remittance data; caching, staleness, and
  refresh semantics; the masking/permission model for sender/recipient PII;
  reconciliation of the three independent statuses; error/permission/multiple-
  match handling. Sits behind the `RelatedTransaction` service seam so the
  frontend is unchanged. Technology stays deferred (§17).
- **Exclusions:** Any production build; backend technology selection.
- **Dependencies:** M13; MVP backend-readiness gate (M12).
- **Acceptance:** ✅ A written plan for transaction lookup + synchronization that
  preserves the standalone principle and the typed-service seam —
  [`transaction-integration-plan.md`](transaction-integration-plan.md).
- **Complexity:** M.
- **As-built notes:** Plan covers the seam mapping (mock→REST), lookup cardinality
  (0/1/many), read-through caching + staleness + refresh, server-side masking +
  ownership authz, three-status reconciliation via derived exceptions, and
  graceful degradation. Written against the real M13 `transactionService`
  contract so M18 is a drop-in reimplementation.

## M18 — Production integration — GGX transaction / payment / remittance (L) — ⏳ **planned**

- **Objective:** Replace simulated transaction data with live GGX systems.
- **Included:** Production integration with GGX transaction/OMS, payment, and
  remittance systems behind typed async services (extends §18); replaces the mock
  `RelatedTransaction` and simulated prefill. GGX systems remain **integrations,
  never a runtime foundation** for HeyQ.
- **Exclusions:** Coupling HeyQ's domain model to GGX at runtime.
- **Dependencies:** M17.
- **Acceptance:** Live transaction/payment/remittance data flows through the
  unchanged service seam; HeyQ still functions with the integration unavailable.
- **Complexity:** L.

## M19 — Role-based Overview dashboard (M) — ✅ **built**

- **Objective:** A role-adaptive **Overview** as the default authenticated landing
  page — an actionable summary of tickets/issues in the user's scope, routing
  users into the real work rather than replacing it. Full narrative in §22 of the
  [plan](quadx-helpdesk-first-pass-plan.md#22-role-based-overview-dashboard-phase-2-addition--planned-not-built).
- **Included:** One `Overview` page whose content branches by role/scope
  (requester / L1–L2 agent / supervisor / admin / KB editor). **Attention-first**
  lists (urgent, SLA at-risk/breached, unassigned high-priority, escalations,
  reopened, awaiting action) as **lists/tables**; scoped **counters** (open,
  assigned, unassigned, urgent, SLA at-risk, SLA breached, resolved today) as
  **cards** — every counter/row deep-links to a filtered queue/search or the
  ticket detail. Rows show Concern Type, tracking number + shipment/payment status
  (when available), priority, SLA state, assignee, and latest activity. A **charts
  only for a useful trend** rule (reuse M9 CSS charts). **Create ticket / internal
  ticket** access where authorized. Routing: `/app` → Overview; My Queue moves to
  its own path and stays in the nav; the sidebar (Tickets/Queues, KB, Reports,
  Notifications, Administration) is otherwise unchanged.
- **Exclusions:** No widget system, no per-user customization, no role-specific
  dashboard framework; no new data model, services, or dependencies (compose
  `reportsService` + `ticketService` + existing filters/components); no moving the
  3-pane ticket workspace into the dashboard.
- **Dependencies:** M13 (transaction context), M15 (Concern Type), M16 (create
  internal ticket) for the row context and create action; reuses M9
  reports/charts.
- **Acceptance:** ✅ Each simulated identity lands on a **different, relevant**
  Overview from realistic GGX sample data; counters/lists link to the correct
  filtered views/detail; loading, empty, error+retry, stale-data, no-work, and
  **no-urgent-items** states are all covered; the full ticket detail remains the
  primary workspace; direct nav to all areas is retained. 15 tests.
- **Complexity:** M.
- **As-built notes:** `overviewService` is a **thin aggregator** over
  `reportsService` + `ticketService` + `requesterService` + `transactionService` +
  `kbService` — no new data model, no widget system, no new dependency. It returns
  one of three discriminated shapes (`tickets` | `kb` | `requester`) and branches
  by role: **agent** (my attention list + my team's unassigned high-priority pool,
  no chart), **supervisor** (team-scoped SLA/unassigned/escalations/reopened +
  one team trend), **admin** (the same, org-wide, + a by-team trend), **KB editor**
  (drafts/publish pipeline, no queues), **customer** (own tickets + awaiting-reply,
  opening via `/t/:token` — never an agent surface). Counter **cards** and list
  rows all deep-link; queue filters (`status`/`priority`/`q`/`sort`) moved into
  the **URL** so `/app/mine?priority=urgent` is linkable. Rows use a new
  `AttentionTable` (the queue's `TicketTable` carries no transaction columns)
  showing Concern Type + tracking number + shipment/payment badges + a **Stale**
  marker, with a page-level stale banner. Routing: `/app` → Overview (guarded by
  new `OVERVIEW_ROLES`), My Queue → `/app/mine`, Overview in its own **Home** nav
  section. Seed: `customer` identity mapped to requester `req-seed-3` (3 tickets,
  one awaiting her reply, each with a secure link); added `tkt-seed-15` resolved
  earlier on the simulated day so **Resolved today** is a live number.

## M20 — Audit log viewer (S–M) — ✅ **built**

- **Objective:** Turn the `/admin/audit` placeholder into the real, org-wide
  activity trail. The app has recorded audit history since M6–M7 (status events,
  assignments, escalations, internal notes, KB revisions); nothing surfaced it
  outside a single ticket's timeline.
- **Included:** `auditService` — a read-only aggregator unifying the five existing
  histories into one chronological, filterable stream; the `/admin/audit` page
  (filters: event type, actor, free-text search; rows deep-link to the ticket or
  the article). Gated to `AUDIT_ROLES` (team lead + admin), which already existed.
- **Exclusions:** No new audit *writes* and no new event types — if an action isn't
  already recorded, this milestone does not start recording it. No export/retention/
  tamper-evidence (production concerns, not mock ones).
- **Dependencies:** M6 (assignment/escalation history), M7 (KB revisions).
- **Acceptance:** ✅ A lead or admin sees every status change, assignment,
  escalation, note, and article revision newest-first; filters narrow by type,
  actor, and search; rows link back to the ticket/article; an L1 agent is blocked.
  **Internal note bodies never appear** — the trail records that a note was added,
  not what it said (rule #5). 10 tests.
- **Complexity:** S–M.
- **As-built notes:** No model or seed changes at all — the trail is derived
  entirely from existing state, so a new escalation shows up in it immediately
  (proven by test). Filters are URL-backed, matching the M19 queue convention.
  Actor names resolve through the agent roster, falling back to `ROLE_LABELS` so
  the KB editor (who is not an agent) reads as "KB Editor" rather than a raw id.

## M21 — GGX tracking numbers, simplified states & badge hierarchy (M) — ✅ **built**

- **Objective:** Make the ticket lists readable and the state model honest: show the
  identifier customers actually quote (the GGX tracking number), cut the status set
  down to what agents really distinguish, and stop status/priority/SLA shouting at
  equal volume.
- **Included:**
  - **Tracking numbers** in `XXXX-XXXX-XXXX` form (rule #21), denormalized onto
    `TicketListItem` so every list shows them; em dash on non-shipment tickets.
  - **Statuses 7 → 6** (rule #3): `pending_requester` → `on_hold` + **`holdReason`**;
    `reopened` → an **event flag** (`reopenedAt`). Escalation unchanged (rule #2).
  - **Priority 4 → 3** (Low removed). **SLA** presents only On Track / At Risk /
    Breached; `met` and `paused` remain internal states.
  - **Semantic colour + badge hierarchy** (rules #23–24): brand colour carries no
    state meaning, In Progress is blue, only Urgent/Breached are red, escalation is
    a labelled indicator.
  - **One shared `TicketTable`** across queues, saved views, search, and the Overview;
    **search** extended to tracking number, concern type, and requester email.
- **Exclusions:** No new search service, state layer, or token system; no new
  dependencies. Existing components reused throughout.
- **Dependencies:** M13 (transactions), M15 (Concern Type), M19 (Overview).
- **Acceptance:** ✅ All seeded tracking numbers match the format and are unique;
  full and partial tracking search work; the seed exercises all six statuses, both
  hold-reason kinds, escalation, reopening, all priorities, and on-track/at-risk/
  breached SLA; no status maps to brand or destructive colour. 149 tests.
- **Complexity:** M.
- **As-built notes:** `AttentionTable` was **deleted** — it was a second definition
  of how ticket state looks. Every ticket row in the app now renders through one
  component (D39). The SLA resolution clock pauses on hold **only for external
  blockers** (D35) — a ticket blocked on our own team keeps burning the clock,
  since pausing it would hide the very delay the SLA exists to surface. Reopened,
  being a flag rather than a status, gets a `?reopened=1` URL filter (clearable
  chip) plus a saved view, since it cannot live in the status select.

## M22 — GGX Business+ integration, HeyQ side (M–L) — ✅ **built**

- **Objective:** The complete Business+ support flow inside HeyQ — linked-order
  ticket submission through agent handling, requester replies, resolution, and
  reopening — behind a replaceable provider seam, with **no Business+ repository
  work**.
- **Included:** `OrderProvider` boundary + mock (org-scoped authorization,
  search, availability toggle); order picker on `/contact` for Business+
  identities with a `?order=` handoff deep link and a continue-without-order
  path; `Ticket` gains `sourceSystem` + `linkedOrder` (stable external id,
  tracking number, snapshot captured at submission); `LinkedOrderPanel` in the
  agent detail (snapshot-first, support-scoped live check) and a snapshot card in
  the requester portal; the full existing lifecycle over linked tickets. The
  Business+ contract is documented in
  [`business-plus-integration.md`](business-plus-integration.md).
- **Exclusions:** The Business+ side itself; real SSO/OAuth/webhooks/queues;
  shipment mutations; any new status.
- **Dependencies:** M13 (transaction patterns), M21 (tracking-number format).
- **Acceptance:** ✅ A Business+ requester lists only their organization's
  orders, links one (or declines), and the ticket runs the standard lifecycle —
  queue reception, assignment, public reply, internal-note privacy, requester
  reply, resolve, reopen — with consistent queues/search/counters. Cross-org
  linking is rejected at the service boundary without creating a ticket. With the
  provider down: the form degrades to no-order submission, and existing linked
  tickets keep rendering from their snapshot. A live shipment change never moves
  ticket status. 20 unit/page tests + 2 e2e tests (×3 viewports).
- **Complexity:** M–L.
- **As-built notes:** Authorization is re-checked in `createTicket`, not just the
  picker, and a failed link never half-creates a ticket. The `customer` identity
  carries a simulated Business+ session (`bp-user-nadia` @ Acme Retail);
  `tkt-seed-18` seeds a linked ticket whose live shipment (delivered) has moved
  past its snapshot (in transit) to demo refresh + status independence. The
  token-scoped portal renders the snapshot only and never calls the provider.
  `trackingNumberFor` resolves snapshot-first, so linked tickets appear in every
  table/search like any other ticket. No `closeTicket` service was added —
  closure remains the seeded auto-close rule, and reopen already covers
  resolved|closed.

---

# Milestone 1 — Foundation & QuadX Theme (detailed plan)

> **Status: ✅ Implemented** (committed locally). All gates pass: `tokens`,
> `lint`, `typecheck`, `test` (9/9), `build`. Verified in-browser. As-built notes
> are inline below; deviations from the original plan are recorded in
> [`decision-log.md`](decision-log.md) (M1.1–M1.6).

**Objective.** Stand up a GGX-Corporate-style project that builds, type-checks,
lints, and renders a **themed, responsive application shell** in **light and
dark** with **QuadX red** as the brand color — plus a small validation page —
so every later milestone builds on a proven foundation.

**Exclusions (do not build in M1).** No help-center, ticket, agent, requester,
reporting, or admin *screens*. No helpdesk molecules, no mock domain services,
no full route tree. Only the shell, theme, and a validation page.

**Dependencies.** None. Requires read access to `../GGX Corporate` for component
and token reuse. The exact QuadX red hex (A6) is a placeholder and does not block.

## 1. Project setup (GGX-Corporate-based)

Mirror the verified GGX Corporate toolchain — do not invent a new stack:

- **Vite 6** + `@vitejs/plugin-react`, **React 18.3**, **React Router 7**,
  **TypeScript 5.6**, **Tailwind v4** via `@tailwindcss/vite`.
- Config parity with GGX: `vite.config.ts`, `tsconfig*.json` (`tsc -b`),
  `index.html`, `package.json` scripts (`dev`, `build`, `typecheck`, `tokens`).
- Copy `cn()` (`lib/utils.ts`) and the `class-variance-authority` + `clsx` +
  `tailwind-merge` convention.

## 2. Proposed folder structure

Mirror GGX `src/app`:

```
HeyQ/
  index.html
  package.json  vite.config.ts  tsconfig*.json
  tokens/
    tokens.json                 # GGX tokens + QuadX brand + dark set
  scripts/
    build-tokens.mjs            # extended to emit .dark block
  src/
    main.tsx
    styles/
      theme.css                 # GENERATED — do not hand-edit
    app/
      App.tsx
      routes.tsx                # shell + /_'validation' route only in M1
      components/
        ui/                     # vendored GGX SHADCN primitives (minimum set)
        layout/                 # AppShell, Header, Sidebar
      contexts/
        ThemeContext.tsx        # NEW — toggles .dark on <html>
      lib/
        utils.ts                # cn()
      pages/
        Validation.tsx          # theme/component validation page
```

`components/helpdesk/`, `services/`, `data/`, `hooks/` directories are created
empty or deferred to the milestones that need them — **no abstractions built
only for future use**.

## 3. Initial GGX SHADCN components to reuse

Vendor only what the shell + validation page need:
**Button, Card, Badge, Alert, Input, Field, Select, Tabs, Tooltip, Separator,
Avatar, PageHeader** (+ `Breadcrumb` if the shell uses it). Keep `cn()`/CVA
conventions intact. The remaining ~18 components come in later milestones.

## 4. Token pipeline reuse + QuadX red + dark mode

This is the substantive M1 work (see
[`design-system-strategy.md`](design-system-strategy.md)):

1. **Copy** `tokens/tokens.json` and `scripts/build-tokens.mjs` from GGX.
2. **QuadX brand layer:** override `--primary`, `--primary-foreground`, `--ring`
   (and focus) to a **QuadX red** placeholder in `tokens.json`. Keep
   `--destructive` unchanged (danger only).
3. **Separate brand red from destructive red:** choose a QuadX red value
   **visibly distinct** from `--destructive` (`#d4183d`); document both together
   and validate WCAG AA contrast in light and dark.
4. **Dark mode:** add a **dark color set** to `tokens.json` and **extend
   `build-tokens.mjs`** to emit a `.dark { … }` block alongside `:root`
   (`@custom-variant dark` is already declared). Regenerate `theme.css`.
5. **Theme toggle:** add a minimal `ThemeContext` that toggles the `.dark` class
   on `<html>`, persists the choice, and respects `prefers-color-scheme` on
   first load. No library.

## 5. Minimal responsive application shell

- **Header:** brand mark, theme toggle, and a **disabled GGX brand control**
  (locked chip: "GGX" active + "More brands coming soon"). Placeholder slots for
  search / notifications / identity switcher (wired in M2, not M1).
- **Sidebar:** static placeholder nav (structure only; role gating is M2).
- **Content:** placeholder region using the `PageHeader` pattern.
- **Responsive:** shell collapses sidebar at tablet width; header stays usable at
  mobile width.

## 6. Theme / component validation page

A single `/` (or `/_validate`) page that renders the vendored primitives in a
gallery: buttons (primary = QuadX red), badges, alerts (including a
**destructive** example next to a **brand** example to prove they are distinct),
inputs/fields, tabs, tooltip, card. Serves as the manual light/dark and
brand-vs-danger check surface.

## 7. Quality gates (minimum)

- **Lint:** minimal ESLint + TypeScript config (add if not carried from GGX).
- **Type-check:** `tsc -b --noEmit` clean.
- **Build:** `vite build` succeeds.
- **Tokens:** `npm run tokens` regenerates `theme.css` deterministically.
- **Accessibility (minimum):** keyboard-reachable controls, visible focus, toggle
  has an accessible label; contrast validated on primary surfaces in both modes.
- **Interaction (minimum):** theme toggle switches modes; disabled brand control
  is non-interactive. Add a **minimal test setup** (e.g. Vitest + Testing
  Library) with 1–2 smoke tests (shell renders; toggle flips `.dark`). GGX ships
  no test runner, so this is a justified new dev dependency.

## 8. Likely files to create or modify

- `package.json`, `vite.config.ts`, `tsconfig.json`, `tsconfig.app.json`,
  `tsconfig.node.json`, `index.html`, `.eslintrc`/eslint config
- `tokens/tokens.json` (QuadX brand + dark set)
- `scripts/build-tokens.mjs` (emit `.dark` block)
- `src/styles/theme.css` (generated)
- `src/main.tsx`, `src/app/App.tsx`, `src/app/routes.tsx`
- `src/app/contexts/ThemeContext.tsx`
- `src/app/components/ui/*` (vendored minimum set)
- `src/app/components/layout/{AppShell,Header,Sidebar}.tsx`
- `src/app/lib/utils.ts`
- `src/app/pages/Validation.tsx`
- 1–2 smoke test files + test config

## 9. Step-by-step implementation sequence

1. Scaffold the Vite/React/TS/Tailwind-v4 project matching GGX config; verify
   `dev`/`build`/`typecheck` on an empty app.
2. Copy `tokens.json` + `build-tokens.mjs`; run `npm run tokens`; confirm
   `theme.css` regenerates (light-only baseline).
3. Extend `tokens.json` with the **dark set** and **QuadX red brand layer**;
   extend `build-tokens.mjs` to emit `.dark`; regenerate; verify variables.
4. Vendor the minimum GGX SHADCN component set + `cn()`.
5. Add `ThemeContext` + theme toggle (`.dark` on `<html>`, persisted).
6. Build the responsive shell (Header + disabled brand control, Sidebar,
   Content).
7. Build the validation page (gallery incl. brand-vs-destructive proof).
8. Add lint config + minimal test setup; write the 1–2 smoke tests.
9. Run all gates (lint, type-check, build, tokens, tests); validate light/dark +
   contrast manually.

## 10. Acceptance criteria

- `dev`, `build`, `typecheck`, `tokens`, `lint`, and the smoke tests all pass.
- The themed shell renders in **light and dark**; the theme toggle switches modes
  and persists.
- **Primary color is QuadX red** and is **visibly distinct from `destructive`**;
  contrast meets WCAG AA on primary surfaces in both modes.
- The **disabled GGX brand control** renders and is non-interactive.
- The shell is usable at mobile (header) and tablet (collapsed sidebar) widths.
- No help-center/ticket/agent/requester/reporting/admin screens exist yet.

## 11. Recommended frontend dependencies for M1 (install later, not now)

Only when justified; all frontend-only:

- **Vitest + @testing-library/react + jsdom** — minimum test setup GGX lacks
  (justified: interaction/smoke checks).
- **ESLint + typescript-eslint** (+ config) — if not carried from GGX.
- Everything else (icons via `@tabler/icons-react`, `recharts`, router, CVA
  stack) is **already part of the GGX baseline** being copied — no new choice.

Query/mutation abstraction, accessibility-audit helpers, and interaction
libraries are **deferred to the milestone that first needs them** (M2+), per the
"no abstractions for hypothetical future use" rule.
