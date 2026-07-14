# Session State

Living status of the HeyQ project. Update this at the end of each working
session so the next one can resume without re-deriving context.

_Last updated: 2026-07-13_

## Current phase

**Milestones 1–10 implemented and passing all gates.** A standalone HeyQ app —
QuadX theme + light/dark, full route tree + role gating, public help center,
ticket submission + requester portal, agent workspace, triage, KB admin, admin
config, notifications + reporting, and **full state coverage** (loading / empty /
error+retry / validation / success across every view). The approved source of
truth is [`quadx-helpdesk-first-pass-plan.md`](quadx-helpdesk-first-pass-plan.md).

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

## Next up

**Milestone 11 — Light/dark, responsive, a11y & interaction QA** (see
[`roadmap.md`](roadmap.md)): dual-mode audit, responsive breakpoints,
keyboard/focus/screen-reader passes, per-role review.

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
