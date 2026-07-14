# Session State

Living status of the HeyQ project. Update this at the end of each working
session so the next one can resume without re-deriving context.

_Last updated: 2026-07-14_

## Current phase

_Last session: Milestones 19 (role-based Overview dashboard), 20 (audit log
viewer), and 21 (ticket-field & state-presentation rework) built._

**All 12 milestones implemented — the frontend-first MVP is complete.** A
standalone HeyQ app: QuadX theme + light/dark, full route tree + role gating,
public help center, ticket submission + requester portal, agent workspace,
triage, KB admin, admin config, notifications + reporting, full state coverage,
QA polish, and the backend-readiness assessment
([`backend-readiness.md`](backend-readiness.md)). The only remaining item is
stakeholder **sign-off** to proceed to backend planning — a decision, not a
build. The approved source of truth is
[`quadx-helpdesk-first-pass-plan.md`](quadx-helpdesk-first-pass-plan.md).

**Post-MVP Phase 2 — frontend items M13–M16 and M19 are BUILT** (see "Done
(Phase 2)" below); backend items **M17–M18 remain planned**. Direction captured in
§21–§22 of the plan, [`roadmap.md`](roadmap.md) M13–M19, product rules 13–20, and
decisions D19–D29. Status: (1) GGX transaction context + sample data ✅,
(2) theme & visual-hierarchy refinement ✅, (3) Concern Type in queues ✅,
(4) internal ticket creation ✅, (5) backend transaction lookup & sync planning ✅
(plan written), (6) production GGX integration ⏳, (7) **role-based Overview
dashboard ✅ — now the default authenticated landing**.

## Repository state

- **Git initialized**; Milestone 1 committed locally. No remote configured; nothing pushed.
- Standalone Vite/React/TS/Tailwind-v4 app with its own packages, config,
  tokens, components, theme system, tests, and build.
- `../GGX Corporate` used as visual/technical reference only — **no runtime
  dependency**; primitives were re-authored against semantic tokens.

## Done (Milestone 1)

- Full `docs/` planning set + this session state.
- Scaffolded Vite + React 18 + TS + Tailwind v4 (own `package.json`).
- Local token pipeline (`tokens/tokens.json` → `scripts/build-tokens.mjs` →
  `src/styles/theme.css`) emitting **both** `:root` (light) and `.dark` blocks.
- Provisional **QuadX red `#E11900`** (scalar), distinct from destructive
  `#D4183D`; verified distinct in computed styles, light + dark.
- Persisted `ThemeContext` toggle (`.dark` on `<html>`, respects
  `prefers-color-scheme`).
- Responsive shell: Header (brand mark + **disabled** GGX brand control + theme
  toggle), off-canvas Sidebar, content area; Overview + Validation pages.
- Minimum vendored UI primitives (Button, Card, Badge, Alert, Input, Separator,
  FormField) + `cn()`, all token-based.
- ESLint, Vitest + Testing Library, 9 smoke tests (theme, shell, tokens).
- **Gates green:** tokens ✓, lint ✓ (2 fast-refresh warnings), typecheck ✓,
  tests 9/9 ✓, build ✓. Verified in-browser (dark via OS pref, no console errors).

## Done (Milestone 2)

- Full route tree (public `/help`, `/contact`, `/t/:token`; agent `/app/*`;
  admin `/admin/*`) with public + authenticated (`AppLayout`) shells.
- `IdentityContext` — 7 persisted demo identities (guest → admin, agents carry
  tier/team); native-`<select>` `IdentitySwitcher` in the header.
- `config/navigation.ts` + `lib/roles.ts` role groupings drive role-aware
  sidebar sections **and** `RequireRole` route guards from one source.
- Reusable `PlaceholderPage` (surfaces route params); removed M1 `Overview`.
- **Gates green:** tokens ✓, lint ✓ (3 fast-refresh warnings), typecheck ✓,
  tests **15/15** ✓, build ✓. Verified in-browser (live nav gating + guard).

## Done (Milestone 3)

- KB layer: `models/kb.ts`, `data/kb.ts` (13 public + 1 internal + 1 draft
  article across 6 categories/1 subcategory), `services/kbService.ts`
  (published+public filtering in one place), `hooks/useQuery.ts` (thin wrapper),
  `lib/mock.ts` (latency/clone).
- Help pages: home (search hero, featured, category grid), category listing,
  article view (breadcrumb, last-updated, body, related), search results — all
  under `PublicLayout`, reachable by any role.
- Help components: `ArticleCard`, `CategoryCard`, `HelpSearchBox`, `ArticleBody`,
  `HelpStates` (loading/empty), plus a `ui/Breadcrumb` primitive.
- **Gates green:** tokens ✓, lint ✓ (3 fast-refresh warnings), typecheck ✓,
  tests **29/29** ✓, build ✓. (Browser spot-check deferred — MCP classifier
  outage during the session; automated tests cover the acceptance criteria.)

## Done (Milestone 4)

- Models: `ticket.ts`, `support.ts`. Seed: `data/tickets.ts` (2 demo tickets w/
  tokens), `data/catalog.ts` (4 teams, 11 concern categories, 1 transaction).
- Services: `catalogService`, `ticketService` (create/reply/reopen, mutates
  module state), `requesterService` (token→portal). `useMutation` hook;
  `makeId`/`nowIso` helpers.
- Pages: `/contact` progressive form (conditional fields, transaction prefill,
  attachments-as-metadata, validation, confirmation w/ reference + secure link),
  `/t/:token` portal (status, details, thread, reply, reopen).
- Components: `StatusChip`, `ConversationThread`, `AttachmentPicker`; `ui/Select`,
  `ui/Textarea`. `formatDateTime` util.
- **Gates green:** tokens ✓, lint ✓ (3 fast-refresh warnings), typecheck ✓,
  tests **41/41** ✓, build ✓. Browser-verified (portal + transaction prefill).

## Done (Milestone 5)

- `InternalNote` type + SLA types + view models (`TicketListItem`,
  `TicketDetailView`, `TimelineEvent`). `lib/clock.ts` (fixed simulated now),
  `slaService` (compute + at-risk/breached).
- Expanded ticket seed (8 tickets across queues + SLA states, internal notes,
  status events, agents in catalog). Agent-facing `ticketService` functions
  (`listTickets`, `getTicketDetail`, `addAgentReply`, `addInternalNote`,
  `resolveTicket`).
- Pages: shared `AgentQueuePage` + My Queue / Team / Unassigned / Escalated /
  SLA / Search / Saved Views; 3-pane `TicketDetail`.
- Components: `TicketTable`, `AgentConversation` (notes badged/tinted),
  `TicketComposer` (reply/note toggle), `badges` (SLA/priority).
- **Gates green:** tokens ✓, lint ✓ (4 fast-refresh warnings), typecheck ✓,
  tests **52/52** ✓, build ✓. Browser-verified (3-pane detail; internal note
  present in agent view, absent in portal).

## Done (Milestone 6)

- `Assignment` + `Escalation` history types & seed (incl. tkt-seed-7's
  escalation). `ticketService`: `claimTicket`, `assignTicket`,
  `reclassifyTicket` (re-route on category change), `escalateTicket`
  (state/tier/team/owner + history, status unchanged), `deescalateTicket`.
  Timeline merges status + assignment + escalation. `catalogService.listAgents`.
- `TicketActions` component (assignment / classification / escalation panels) in
  the detail right pane.
- **Gates green:** tokens ✓, lint ✓ (4 fast-refresh warnings), typecheck ✓,
  tests **61/61** ✓, build ✓. Browser-verified (escalated ticket: state separate
  from status, timeline history, controls).

## Done (Milestone 7)

- `KbRevision` type + seed; `kbService` admin reads (`listAllArticles`,
  `getArticleForEdit`, `listAllCategories`) and writes (`createArticle`,
  `updateArticle` w/ revision snapshot, `publishArticle`, `unpublishArticle`,
  `setArticleVisibility`, `listRevisions`).
- Nested `/admin/kb` routes (list / new / :id); `KbAdminList` (all articles +
  publish toggle) and `KbArticleEditor` (create/edit, visibility, publish,
  revisions).
- **Gates green:** tokens ✓, lint ✓ (fast-refresh warnings only), typecheck ✓,
  tests **68/68** ✓, build ✓. Browser-verified (admin list).

## Done (Milestone 8)

- `adminService` (agent active/tier, add team, add category/subcategory, set
  routing team, get/update SLA config). `slaConfig` in catalog now drives
  `slaService`; agents gain `active`.
- Pages: Agents, Teams, Routing, SLA, Categories (wired to `/admin/*`).
- **Gates green:** tokens ✓, lint ✓ (fast-refresh warnings only), typecheck ✓,
  tests **76/76** ✓, build ✓. (Browser check skipped — MCP classifier outage;
  service tests prove routing + SLA config flow downstream.)

## Done (Milestone 9)

- `Notification` model + seed; `notificationService` (`emit` w/ dedup + mute
  prefs, list/unread/markRead/markAllRead) wired into ticketService actions
  (requester reply, agent reply, assign, escalate, resolve).
- `reportsService.getSummary(teamId?)`; shared `Dashboard` (`/app/reports` all,
  `/app/supervisor` team). Dependency-free CSS bar charts + stat tiles.
- Header `NotificationBell` (unread badge), `/app/notifications` feed page with
  mute toggle + mark-read, Notifications nav item.
- **Gates green:** tokens ✓, lint ✓ (fast-refresh warnings only), typecheck ✓,
  tests **85/85** ✓, build ✓. Browser-verified (dashboard counters/charts; feed).

## Done (Milestone 10)

- Reusable `ErrorState` (retry via `useQuery.refetch`) wired into every
  query-backed page (help home/category/article/search, agent queues, ticket
  detail, requester portal, dashboard, notifications, KB admin). Loading, empty,
  validation, and success states already existed.
- **Gates green:** tokens ✓, lint ✓ (fast-refresh warnings only), typecheck ✓,
  tests **87/87** ✓, build ✓.

## Done (Milestone 12)

- [`backend-readiness.md`](backend-readiness.md): service-seam → endpoint
  inventory, typed contracts as API shapes, simulated→production gap table,
  standalone/Zendesk-independence, deferred tech selection, readiness checklist.
- **Gates green (final):** tokens ✓, lint ✓ (fast-refresh warnings only),
  typecheck ✓, tests **90/90** ✓, build ✓.

## Done (Phase 2 — M13–M16, built ahead of formal sign-off)

- **M15 Concern Type:** `concernType` field + `ConcernType` enum/labels; seeded on
  all tickets; derived by category on create; editable in classification; neutral
  `ConcernTypeBadge`; **Concern Type column** (desktop) folding into the subject
  summary on mobile.
- **M13 Transaction context:** expanded `RelatedTransaction`; `transactionService`
  (`getTransactionForTicket`/`lookupByTracking`/`refreshTransaction`) modelling
  loading/found/stale/unavailable/permission/multiple/invalid; `TransactionPanel`
  in the detail left pane with manual refresh + tracking lookup + link; 11 seeded
  transactions across the ten scenarios (tickets `tkt-seed-1/2/3/6/7` + new 9–14);
  shipment/payment/remittance badges. Three statuses independent of ticket status.
- **M16 Internal tickets:** `createInternalTicket` (source `internal`, reporter,
  audit, notifications off by default; on only when external + opted in);
  `NewTicket` page at `/app/tickets/new`; **New ticket** action on the queues;
  reply/resolve "emailed" markers gated by `requesterNotificationsOn`.
- **M14 Theme:** primary → deep burgundy (`#9E1B2E`/`#B5273A`); new teal
  `accent-brand` for selected nav + links; `destructive` unchanged for errors;
  statuses spread across the palette. Tokens regenerated; sync guard + tokens test
  green.
- **Gates green:** tokens ✓, lint ✓ (fast-refresh warnings only), typecheck ✓,
  tests **104/104** ✓, build ✓.

## Done (Milestone 19 — role-based Overview dashboard)

- **`overviewService`** — a thin aggregator over `reportsService` +
  `ticketService` + `requesterService` + `transactionService` + `kbService`. No new
  data model, no widget system, no new dependency. Returns one of three
  discriminated shapes (`tickets` | `kb` | `requester`) and branches by role:
  agent (my attention list + team's unassigned high-priority pool), supervisor
  (team-scoped SLA / unassigned / escalations / reopened + one team trend), admin
  (same, org-wide + by-team trend), KB editor (drafts pipeline, no queues),
  customer (own tickets + awaiting-reply).
- **`Overview` page** at `/app` (new `OVERVIEW_ROLES` guard) — counter **cards**
  that each link to the filtered list they count, attention **tables**, and the six
  states (loading, empty/no-work, error+retry, stale-data banner, no-urgent-items
  "all clear", and the requester's empty case).
- **Routing/nav:** `/` and `/app` → Overview; **My Queue moved to `/app/mine`**;
  Overview sits in its own **Home** nav section (a KB editor and a customer land
  there too). Every other route and nav entry is unchanged.
- **Queue filters are now URL-backed** (`?status=`, `?priority=`, `?q=`, `?sort=`)
  and `listTickets` gained `priority` + `requesterId` filters — this is what makes
  a counter like Urgent deep-link to `/app/mine?priority=urgent`.
- **`AttentionTable`** — the Overview's row carries GGX transaction context the
  queue table doesn't: tracking number, shipment/payment badges, and a **Stale**
  marker (M13 freshness convention).
- **Seed:** the `customer` identity is now **Nadia Cruz** → requester `req-seed-3`
  (3 tickets, one awaiting her reply, each with a secure link); `tkt-seed-8` moved
  to her; new `tkt-seed-15` resolved earlier on the simulated day so **Resolved
  today** is a live number.
- **Gates green:** tokens ✓, lint ✓ (fast-refresh warnings only), typecheck ✓,
  tests **119/119** ✓, build ✓.

## Done (Milestone 20 — audit log viewer)

- **`auditService`** — a read-only aggregator unifying the five histories the app
  already records (status events, assignments, escalations, internal notes, KB
  revisions) into one newest-first, filterable trail. **No model or seed changes**;
  a new escalation appears in the trail immediately because it is derived, not
  stored.
- **`/admin/audit`** is now a real page (was a placeholder since M8): filters by
  event type / actor / free-text, URL-backed (the M19 convention); rows deep-link
  to the ticket or the KB article. Gated by the pre-existing `AUDIT_ROLES`
  (team lead + admin) — an L1 agent is blocked.
- **Internal note bodies never enter the trail** — it records *that* a note was
  added, not what it said (rule #5, asserted by test). Actor names fall back to
  `ROLE_LABELS`, so the KB editor reads as "KB Editor", not a raw id.
- **Gates green:** tokens ✓, lint ✓ (fast-refresh warnings only), typecheck ✓,
  tests **129/129** ✓, build ✓.

## Done (M21 — GGX tracking numbers, simplified states, badge hierarchy)

- **Tracking numbers** are now `XXXX-XXXX-XXXX` (12 uppercase alphanumerics, three
  groups; e.g. `1GGT-AYT1-TKK3`). All 12 seeded transactions reformatted and unique;
  `trackingNumber` is denormalized onto `TicketListItem`, so **every** ticket table
  shows it (em dash on non-shipment tickets). Format is asserted by test.
- **Statuses simplified 7 → 6:** New, Open, In Progress, **On Hold**, Resolved,
  Closed. `pending_requester` → `on_hold` + **`holdReason`** (requester / internal
  team / third party / scheduled follow-up / other). `reopened` → an **event flag**
  (`reopenedAt`); a reopened ticket returns to Open or In Progress and is filtered
  via `?reopened=1`. Escalation stays a separate dimension (rule #2).
- **SLA clock pauses on hold only for external blockers** (requester, third party,
  follow-up) — a ticket blocked on our own team keeps burning the clock (D35).
- **Priority dropped `low`** → Normal / High / Urgent.
- **Badge hierarchy (D37/D38):** status is always a subtle semantic chip
  (In Progress is **blue, never red**); priority is plain text / amber text / red
  pill; SLA is muted text / amber / red. Escalation has a **labelled indicator**
  (icon + text + tooltip + accessible name), not a bare arrow.
- **One shared `TicketTable`** across queues, saved views, search, and the Overview
  (`AttentionTable` deleted). Sticky header, row hover/focus, relative "3h ago" time
  with the exact timestamp in a tooltip, responsive column shedding that folds
  concern/tracking/priority into the subject cell instead of hiding them.
- **Search** now matches partial or full reference, tracking number, concern type,
  subject, requester name, and requester email. New ticket action on every queue.
- **Seed** covers all six statuses, both hold-reason kinds, escalated, reopened,
  non-shipment, all priorities, and on-track/at-risk/breached.
- **Gates green:** tokens ✓, lint ✓ (fast-refresh warnings only), typecheck ✓,
  tests **149/149** ✓, build ✓.

### M21 intentional exceptions (agreed deviations, not oversights)

1. **`SlaState` keeps `met` and `paused`** even though the table only ever shows
   On Track / At Risk / Breached. They are real internal conditions (the detail
   pane shows them per target), so they were demoted in presentation rather than
   deleted from the model — exactly as the brief allows.
2. **`EscalationState` keeps `returned_to_l1`.** It is not a status and not a
   third "escalated" colour; the escalation indicator renders it as a muted
   "Returned to L1".
3. **The SLA clock does not pause for `waiting_internal`** (D35). This is a
   deliberate policy call, not an omission: pausing when we are blocked on our own
   team would conceal the delay the SLA is meant to expose. **Confirm with Support
   Ops** — it is a one-line change in `slaService` if they disagree.
4. **`reopenedAt` is a timestamp flag, not a reopen counter.** Nothing in the
   product needs "how many times", so it is not modelled.
5. **Tracking numbers are unique per transaction.** The brief permits reusing one
   across tickets to show several tickets on one shipment; no seeded case does
   this, to keep the demo unambiguous.

### M21 remaining limitations

- The shared table caps at `max-h-[70vh]` for its sticky header; on very short
  viewports that is tighter than ideal.
- Relative timestamps ("3h ago") are computed against the **simulated** clock, so
  they will read oddly if the simulated `now` is ever moved far from the seed data.

## Verification status (browser smoke pass)

A **Playwright smoke suite** now exists as a proxy for the manual QA pass:
`npm run test:e2e` (config `playwright.config.ts`, specs `e2e/smoke.spec.ts`).
**45 checks pass** across three viewports — desktop 1440×900, tablet 768×1024,
mobile 375×812. It runs Chromium only and is deliberately **not** a pixel-diff
suite (those break on every copy change).

### Verified automatically

- **Every primary route renders with zero console/page errors** at all three
  widths: `/app` (agent, supervisor, customer), `/app/mine`, `/app/team`,
  `/app/views`, `/app/tickets/:id`, `/app/reports`, `/admin/audit`, `/contact`.
- **No page-level horizontal overflow** at any width (wide tables scroll inside
  their own box, which is intended; the *page body* must not pan — asserted).
- **Dark mode** loads and applies `.dark` to `<html>` with no runtime errors.
- Tracking numbers show as a column at ≥`md` and **fold into the subject line**
  at mobile rather than vanishing; "Pending Requester" appears nowhere.
- Overview counter → filtered queue drill-down (`/app/mine?priority=urgent`).
- **Reopened** and **On Hold** saved views filter correctly; the reopened filter
  renders as a visible, clearable chip.
- The public contact form rejects a malformed tracking number.

### Still NOT verified — needs human eyes

The smoke suite proves things *render and behave*; it cannot judge whether they
*look right*. Outstanding:

1. **Colour contrast measured against WCAG AA.** The semantic mapping is pinned by
   a unit test (no status is red/brand), but the actual rendered contrast of
   `text-amber-700`/`amber-400`, the green SLA dot, and the subtle status chips has
   **not** been measured in either theme.
2. **Whether the badge hierarchy actually reads as calm** — the core intent of M21.
   This is a judgment call no assertion can make.
3. Hover/focus states and the sticky header's appearance while scrolling.
4. Light mode specifically: the smoke suite forces dark only on one route.

### Routes + viewports for the manual pass

Walk these in **both light and dark**, at **1440px, 768px, and 375px**:

| Route | Identity | What to look at |
|---|---|---|
| `/app` | `l1_agent`, `team_lead`, `admin`, `kb_editor`, `customer` | Counter cards, attention tables, the all-clear/stale states |
| `/app/mine` | `l1_agent` | **Badge hierarchy** — does an ordinary row read as calm? |
| `/app/team` | `admin` | Tracking + Concern columns; column shedding at 768/375 |
| `/app/tickets/tkt-seed-7` | `admin` | Escalation indicator, hold panel, SLA badges |
| `/app/tickets/tkt-seed-1` | `l1_agent` | On Hold chip + hold reason |
| `/app/reports` | `admin` | 7 stat tiles (wrap behaviour at 768px) |
| `/admin/audit` | `admin` | Sticky header, actor folding at mobile |
| `/contact` | `guest` | Tracking-number validation message |

### Screenshots

33 full-page PNGs at **`e2e/screenshots/`** (`{viewport}-{route}.png`, plus
`{viewport}-queue-mine-dark.png`). They are **gitignored** — regenerate with
`npm run test:e2e`.

## Next up

**Every frontend milestone is built.** MVP (M1–M12) complete; Phase 2 frontend
(M13–M16, M19) complete. **Nothing frontend is left on the roadmap.**

The only remaining work is **backend**, and it is gated:

- **M17** — backend transaction lookup & sync planning: ✅ **plan written**
  ([`transaction-integration-plan.md`](transaction-integration-plan.md)).
- **M18** — production GGX transaction/payment/remittance integration: ⏳ blocked.
  It needs (a) stakeholder **sign-off** on the frontend (a decision, not a build)
  and (b) a **backend technology selection** (§17, still deferred). Both are
  outside this repo's control. When they land, M18 is a drop-in reimplementation
  behind the unchanged `transactionService` seam.

Open questions (A3–A6, identity set, reporting depth) remain non-blocking; A6 now
covers the burgundy + teal values.

The audit log viewer (**M20**) has since been built, so the **only remaining
placeholder is `/admin/settings`** (brand config, notification prefs, demo/clock
settings) — small, largely covered by the existing admin screens, and not on the
roadmap. Everything else frontend is done.

## Open questions (non-blocking for M1)

| # | Question | Recommended default | Confirm with |
|---|---|---|---|
| A3 | Concern taxonomy for seed data | Provided category list, admin-editable in mock | Support Ops |
| A4 | SLA placeholder targets | First-response 4h, resolution 2 business days | Support Ops |
| A5 | Business hours for SLA sim | Single PH (Asia/Manila) Mon–Fri calendar | Support Ops |
| A6 | QuadX red brand value (must differ from `destructive`) | **Provisional `#E11900`** in use (scalar, reversible); distinct from `#d4183d`; confirm final value + full WCAG AA audit | Brand/Design |
| — | Simulated identity model | Role/tier/team demo set for the switcher | Product/Design |
| A8 | Reporting depth | Operational counters + a few charts, not analytics | Support Ops |
| D10 | Query/mutation layer: library vs thin in-house wrapper | **Resolved** (M2.1): thin in-house wrapper; implemented in M3 with first reads | Frontend |

These shape seed data/theming but **do not block foundation work** (M1).

## Guardrails (carry every session)

- Escalation ≠ status; 7 statuses only; classification fields stay separate.
- Internal notes never in requester views; portal access via token, not
  reference.
- Components use typed async services only; keep the future-API seam clean.
- GGX-only; brand switcher disabled; QuadX red distinct from destructive.
- No backend, no overengineering (see [`decision-log.md`](decision-log.md) D18).
- No code, packages, branches, or commits until the plan is reviewed/approved.
