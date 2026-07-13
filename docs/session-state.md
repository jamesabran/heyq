# Session State

Living status of the HeyQ project. Update this at the end of each working
session so the next one can resume without re-deriving context.

_Last updated: 2026-07-13_

## Current phase

**Milestones 1–2 implemented and passing all gates.** A standalone HeyQ app
exists with the QuadX theme + light/dark, a full navigable route tree, a
simulated identity switcher, and role-based nav/route gating. The approved
source of truth is
[`quadx-helpdesk-first-pass-plan.md`](quadx-helpdesk-first-pass-plan.md).

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

## Next up

**Milestone 3 — Public help center & article experience** (see
[`roadmap.md`](roadmap.md)). This lands the first `kbService` read, which is
when the thin query/mutation wrapper (D10/M2.1) gets implemented.

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
