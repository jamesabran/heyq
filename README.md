# HeyQ — QuadX Helpdesk Platform (Frontend-First MVP)

HeyQ is the working name for a QuadX-branded helpdesk/support platform. This
repository currently holds the **planning documentation and the Milestone 1
plan** for a **frontend-first, high-fidelity interactive prototype** built on the
GGX Corporate stack and design system.

> **Status:** **Frontend-first MVP complete — all 12 milestones delivered.**
> Standalone Vite/React/TS/Tailwind-v4 app: public help center, ticket submission
> + requester portal, agent workspace (queues, 3-pane detail, replies, internal
> notes, resolve), triage (assign/classify/escalate), KB admin, admin config
> (agents/teams/routing/SLA/taxonomy), simulated notifications, and an operational
> dashboard — all over typed async mock services, QuadX-themed, light/dark, with
> role-based UI. 90 tests, clean build. Awaiting stakeholder sign-off to proceed
> to backend planning (see [`docs/backend-readiness.md`](docs/backend-readiness.md)).
> The approved source of truth is
> [`docs/quadx-helpdesk-first-pass-plan.md`](docs/quadx-helpdesk-first-pass-plan.md).

## What HeyQ is (MVP)

A fully navigable, visually complete helpdesk experience — public help center,
ticket submission, requester tracking, agent workspace, assignment/escalation,
KB and agent administration, simulated notifications, operational reporting,
role-based UI, QuadX red theming, and light/dark modes — driven entirely by
**realistic mock data and simulated workflows** in local state.

- Frontend-first, high-fidelity, interactive
- Powered by typed async **mock services** over realistic seed data
- Based on **GGX Corporate** frontend patterns (React 18, React Router 7,
  Tailwind v4, TypeScript, Vite)
- Reuses **GGX SHADCN** components and the GGX **token pipeline**
- **QuadX red** themed, with **light and dark** modes
- **GGX-only**; a future brand switcher appears as **disabled** UI only

## What HeyQ is not (yet)

No production backend or database, no real authentication/SSO, no live email,
no real file storage, and no OMS/Finance/disbursal/promo integrations. Zendesk
migration and functional multi-brand support are out of scope. See the deferral
sections (§17–§20) of the source-of-truth plan.

> **Long-term requirement (settled, not an open decision):** HeyQ will
> eventually operate as a **standalone platform owning its own backend and
> database, independent of Zendesk**. The production backend technology is
> **not selected yet**. See [`docs/decision-log.md`](docs/decision-log.md).

## Documentation map

| Doc | Purpose |
|---|---|
| [`docs/quadx-helpdesk-first-pass-plan.md`](docs/quadx-helpdesk-first-pass-plan.md) | **Approved source of truth** — full assessment |
| [`docs/product-rules.md`](docs/product-rules.md) | Invariant product rules that must never be violated |
| [`docs/roadmap.md`](docs/roadmap.md) | 12 milestones + **detailed Milestone 1 plan** |
| [`docs/information-architecture.md`](docs/information-architecture.md) | Route tree, navigation, classification model |
| [`docs/mock-data-model.md`](docs/mock-data-model.md) | Contract-shaped TypeScript entities |
| [`docs/roles-and-ui-permissions.md`](docs/roles-and-ui-permissions.md) | Simulated role/tier/team UI gating |
| [`docs/mock-service-layer.md`](docs/mock-service-layer.md) | Async service facades + query/mutation seam |
| [`docs/sla-simulation.md`](docs/sla-simulation.md) | Simulated clock, business hours, warn/breach |
| [`docs/design-system-strategy.md`](docs/design-system-strategy.md) | Token reuse, QuadX red layer, dark mode |
| [`docs/decision-log.md`](docs/decision-log.md) | Key decisions and their rationale (incl. per-milestone) |
| [`docs/backend-readiness.md`](docs/backend-readiness.md) | API seams, contracts, and productionization gaps (M12) |
| [`docs/session-state.md`](docs/session-state.md) | Current state, open questions, next steps |

## Reference projects (not dependencies)

`../GGX Corporate` is the template for framework, structure, conventions,
theming, and mock-data patterns. HeyQ reuses its GGX SHADCN components and
`tokens.json → build-tokens.mjs → theme.css` pipeline. No external backend,
identity, database, or deployment reference is part of this MVP.

## Getting started

```bash
npm install
npm run dev        # start the dev server
npm run tokens     # regenerate src/styles/theme.css from tokens/tokens.json
npm run lint       # eslint
npm run typecheck  # tsc -b --noEmit
npm run test       # vitest (run once)
npm run build      # tokens + tsc + vite production build
```

The app currently renders the Milestone 1 foundation: an application shell and a
**Design system** validation page (`/validation`) that proves QuadX theming,
light/dark, and brand-vs-destructive distinctness. Later milestones add the
helpdesk features (see [`docs/roadmap.md`](docs/roadmap.md)).
