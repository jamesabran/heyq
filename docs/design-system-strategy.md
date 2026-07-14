# Design System Strategy

Reuse the GGX Corporate design system and token pipeline; layer QuadX red on
top; add dark mode. **Do not build a custom design system.** Derived from §10
and grounded in the actual `../GGX Corporate` source.

## What GGX Corporate provides (verified)

- **Stack:** React 18.3.1, React Router 7.13, Tailwind **v4** (`@tailwindcss/vite`),
  TypeScript 5.6, Vite 6.3, Recharts 2.15, Tabler icons, `class-variance-authority`
  + `clsx` + `tailwind-merge` (via `cn()` in `lib/utils.ts`). Radix is used
  sparingly (e.g. `@radix-ui/react-tabs`).
- **SHADCN components:** `src/app/components/ui/*` — ~30 CVA-based components
  (Button, Dialog, Table, Tabs, Select, Combobox, Field, Badge, Breadcrumb,
  Pagination, PageHeader, Calendar, Popover, Tooltip, Alert, Card, Input,
  Textarea, Checkbox, RadioGroup, Switch, Progress, Accordion, Avatar,
  ScrollArea, Separator, …).
- **Token pipeline:** `tokens/tokens.json` → `scripts/build-tokens.mjs` →
  `src/styles/theme.css` (single source of truth). Emits `:root` CSS variables +
  an `@theme inline` block for Tailwind v4. Declares
  `@custom-variant dark (&:is(.dark *))`.

## Two gaps Milestone 1 must close

The GGX pipeline as-is is **light-only** and has **no theme toggle**:

1. **Dark mode values.** `build-tokens.mjs` currently emits only a `:root`
   (light) block; there is no `.dark` override set and no dark values in
   `tokens.json`. HeyQ must extend `tokens.json` with a **dark color set** and
   extend the build script to emit a **`.dark { … }`** block. The `dark` variant
   is already declared, so Tailwind `dark:` utilities work once the block exists.
2. **Theme toggle.** GGX has no `ThemeProvider`/toggle. Add a **minimal theme
   context** that toggles the `.dark` class on `<html>` and persists the choice
   (respect `prefers-color-scheme` on first load). Small and in-house — no
   library.

## QuadX brand token layer

- Add a **`brand.quadx` block** to `tokens.json` overriding `--primary`,
  `--primary-foreground`, `--ring`, and focus colors to **QuadX red**.
  Regenerate via `build-tokens.mjs`. **Do not fork components** — they already
  read `--primary`.
- **Separate brand red from destructive red.** GGX `--destructive` is already a
  red (`#0088C9` primary / `#d4183d` destructive today). QuadX red replaces
  `--primary` and **must be visibly distinct from `--destructive`** so "brand"
  and "danger" never collide. Keep `--destructive` for danger only; introduce a
  distinct brand-red value and **validate WCAG AA in light and dark** for both.
- Candidate QuadX red value is an open item (A6) — placeholder now, confirmed
  with Brand/Design. Token *structure* is not blocked by the exact hex.

## Component strategy

- **Compose GGX SHADCN primitives directly** — Button, Card, Dialog, Table,
  Tabs, Select, Combobox, Field, Badge, Pagination, PageHeader, Tooltip,
  Popover, Alert, etc.
- Add **helpdesk molecules** in a shared `components/helpdesk/` built from those
  primitives: Timeline, InternalNote, SlaBadge, StatusChip, AssigneePicker,
  QueueList, EmailBadge. (Built in later milestones, not M1.)
- **Light/dark verified on every screen.** Responsive: agent workspace
  desktop-first (panes collapse on tablet); help center, submission, and
  requester portal fully mobile-friendly.
- **Accessibility:** reuse GGX SHADCN a11y patterns — keyboard nav, visible
  focus, accessible validation, screen-reader labels.

## How components are brought into HeyQ

Copy/vendor the GGX SHADCN `components/ui/*` set into HeyQ's `components/ui/`
(these are source components, not an installed package), keeping the `cn()` +
CVA conventions. Milestone 1 wires the minimum set needed for the app shell and
validation page; the rest are added as milestones require them.

## Phase 2 — theme & visual-hierarchy refinement (planned, M14)

The provisional QuadX red `#E11900` (A6 / decision M1.1) reads as **too bright
and visually overwhelming**. Phase 2 runs a **theme review** before the palette
is finalized. This stays **token-layer only** — no component fork (D11).

Principles for the review:

- **Red is a brand accent, not the dominant UI color.** Minimize how many red
  elements are visible at once.
- **Test a darker, less saturated primary red** — a possible direction is a
  deeper brand red or **burgundy** for primary branding. The final shade stays
  provisional until reviewed visually.
- **Reserve strong red** for errors, destructive actions, urgent SLA breaches,
  and critical exceptions.
- **Neutral colors** for surfaces, navigation, tables, and ordinary controls.
- **Add a calmer secondary accent** (blue or teal) for standard actions, links,
  selected states, and informational elements — likely a new `--accent` /
  `--accent-foreground` token pair layered onto `tokens.json`.
- **Broaden the status palette** so delivery, payment, ticket, and SLA statuses
  **do not all rely on red** (a small status color scale keyed by meaning, not a
  single hue).
- Keep brand red **distinct from `--destructive`** (the standing rule above).
- **Validate contrast, dark mode, accessibility, and visual hierarchy** in both
  themes before finalizing.

Token structure changes only (adjust `--primary`, add a secondary accent, extend
status tokens); components already read these variables, so no rewrite is needed.
See [`roadmap.md`](roadmap.md) M14 and §21.2 of the plan.

## Overview dashboard component usage (planned, M19)

The role-based Overview (§22 of the plan) composes **existing** components — no
new primitives. Usage rules:

- **Cards** (`Card`) only for concise **counters/summaries**; each counter is a
  link into a filtered queue/search.
- **Lists / tables** for **actionable work** — reuse `TicketTable` and the
  existing list-item view models so rows carry Concern Type, tracking number +
  shipment/payment status, priority, SLA state, assignee, and latest activity,
  and link to the ticket detail.
- **Charts** only for a genuine operational **trend**; reuse the dependency-free
  CSS bar charts from M9 (decision M9.2) — **no new charting dependency**.
- Cover loading (skeletons), empty, error+retry, **stale-data**, **no-work**, and
  **no-urgent-items** states with the existing state components (`HelpStates`
  loading/empty, `ErrorState`). See [`product-rules.md`](product-rules.md) rules
  19–20.

## Explicitly not doing

No custom design system, no component fork for theming, no bespoke token
framework. QuadX theming is **token-layer only**.
