# Session State

Living status of the HeyQ project. Update this at the end of each working
session so the next one can resume without re-deriving context.

_Last updated: 2026-07-13_

## Current phase

**Milestone 1 implemented and passing all gates.** The planning set is complete
and a standalone HeyQ application now exists (shell + QuadX theme + light/dark +
validation page). The approved source of truth is
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

## Next up

**Milestone 2 — App shell, navigation & simulated roles** (see
[`roadmap.md`](roadmap.md)). Not started; out of scope for this session.

## Open questions (non-blocking for M1)

| # | Question | Recommended default | Confirm with |
|---|---|---|---|
| A3 | Concern taxonomy for seed data | Provided category list, admin-editable in mock | Support Ops |
| A4 | SLA placeholder targets | First-response 4h, resolution 2 business days | Support Ops |
| A5 | Business hours for SLA sim | Single PH (Asia/Manila) Mon–Fri calendar | Support Ops |
| A6 | QuadX red brand value (must differ from `destructive`) | **Provisional `#E11900`** in use (scalar, reversible); distinct from `#d4183d`; confirm final value + full WCAG AA audit | Brand/Design |
| — | Simulated identity model | Role/tier/team demo set for the switcher | Product/Design |
| A8 | Reporting depth | Operational counters + a few charts, not analytics | Support Ops |
| D10 | Query/mutation layer: library vs thin in-house wrapper | Decide in M2 when first real reads land | Frontend |

These shape seed data/theming but **do not block foundation work** (M1).

## Guardrails (carry every session)

- Escalation ≠ status; 7 statuses only; classification fields stay separate.
- Internal notes never in requester views; portal access via token, not
  reference.
- Components use typed async services only; keep the future-API seam clean.
- GGX-only; brand switcher disabled; QuadX red distinct from destructive.
- No backend, no overengineering (see [`decision-log.md`](decision-log.md) D18).
- No code, packages, branches, or commits until the plan is reviewed/approved.
