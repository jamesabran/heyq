# SLA Simulation

SLA behavior is **fully simulated** client-side — no persistent timers, workers,
or background jobs. Derived from §7, §9a, and assumptions A4/A5.

## Simulated clock

A central **simulated-clock utility** powers all time-based state so demos feel
live without a backend:

- First-response and resolution countdowns
- SLA **warn** (at-risk) and **breach** transitions
- Auto-close of `Resolved` tickets after N days
- Relative time labels ("2h ago")

Transitions are **deterministic** and computed at view time from the mock
dataset. A "reset demo data" affordance restores the seed state. The clock may
be advanceable in-app for demos (e.g. "jump 4h") — decided when SLA states are
built (Milestone 5).

## Policy inputs (placeholder, admin-editable in mock)

| Input | Placeholder default | Confirm with |
|---|---|---|
| First-response target | 4 hours | Support Ops (A4) |
| Resolution target | 2 business days | Support Ops (A4) |
| Business hours | Single PH (Asia/Manila) Mon–Fri calendar | Support Ops (A5) |
| Auto-close window | N days after Resolved | Support Ops |

Targets are shown as **configurable mock values** on the SLA admin screen, keyed
by priority via `SlaPolicy`.

## States & events

`SlaEvent.type`: `started` → `warned` (at-risk) → `breached`, plus `paused` /
`resumed`. Rendered as SLA badges: **on-track / at-risk / breached**.

- **First-response SLA** starts at ticket creation, stops at first public agent
  reply (`firstResponseAt`).
- **Resolution SLA** runs until `Resolved`.
- **Pause on `Pending Requester`.** When the requester replies
  (`Pending Requester → In Progress`), the resolution clock **resumes**.
- Business-hours calendar means the clock only advances during simulated
  working hours.

## Relationship to status & escalation

SLA state is **independent** of both ticket status and escalation state. A
ticket can be `escalated` and `at-risk` simultaneously; escalation does not
reset SLA timers. See [`product-rules.md`](product-rules.md).

## Acceptance (from §14)

First-response and resolution indicators reflect the simulated clock (on-track,
at-risk, breached) and **pause on `Pending Requester`**; auto-close fires after
the simulated window unless the requester replies (→ `Reopened`).
