# Roadmap

Twelve frontend-first milestones. Sizing S/M/L is **relative effort**, not
calendar time. Only **Milestone 1** has a detailed implementation plan (below);
the rest are concise, implementation-sized entries. Derived from §13.

Milestones 1–3 can begin immediately. Taxonomy, SLA placeholder targets, and the
QuadX red value (see [`session-state.md`](session-state.md)) feed milestones 3–9
but do **not** block foundation work.

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
| 8 | Agent, team, queue & taxonomy administration | M | 6 |
| 9 | Simulated notifications & reporting | M | 6 |
| 10 | State coverage | S–M | 3–9 |
| 11 | Light/dark, responsive, a11y & interaction QA | M | 1–10 |
| 12 | Frontend approval & backend-readiness assessment | S | 1–11 |

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

## M8 — Agent, team, queue & taxonomy administration (M)

- **Objective:** Admin surfaces.
- **Included:** Agent enrollment/roles/tiers/activation, teams/queues, routing
  rules, SLA policies + business hours, concern taxonomy — all simulated config.
- **Exclusions:** Real identity/permission enforcement.
- **Dependencies:** M6.
- **Acceptance:** An admin configures agents, teams, routing, SLA, and taxonomy;
  changes reflect in downstream mock behavior.
- **Complexity:** M.

## M9 — Simulated notifications & reporting (M)

- **Objective:** Feedback + operational visibility.
- **Included:** In-app notification feed + "email sent" markers + prefs/dedup
  (`notificationService`); operational dashboard — counters + simple Recharts
  charts (`reportsService`).
- **Exclusions:** Analytics platform; real delivery.
- **Dependencies:** M6.
- **Acceptance:** Core events produce one in-app notification (and an "email sent"
  marker where applicable); the dashboard reflects the mock dataset.
- **Complexity:** M.

## M10 — State coverage (S–M)

- **Objective:** Robust empty/loading/success/error/validation states.
- **Included:** Every list/detail/form gets defined states across the app.
- **Exclusions:** New features.
- **Dependencies:** M3–M9.
- **Acceptance:** Every screen has defined states.
- **Complexity:** S–M.

## M11 — Light/dark, responsive, accessibility & interaction QA (M)

- **Objective:** Polish & QA.
- **Included:** Dual-mode audit, responsive breakpoints, keyboard/focus/
  screen-reader passes, per-role review pass, interaction QA.
- **Exclusions:** New features.
- **Dependencies:** M1–M10.
- **Acceptance:** Passes a11y + responsive + dual-mode + per-role review.
- **Complexity:** M.

## M12 — Frontend approval & backend-readiness assessment (S)

- **Objective:** Gate to backend planning.
- **Included:** Stakeholder review; document the API contracts/seams; backend
  productionization readiness note (technology still unselected).
- **Exclusions:** Any backend build.
- **Dependencies:** M1–M11.
- **Acceptance:** Sign-off to proceed to backend planning.
- **Complexity:** S.

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
