# Roles & UI Permissions (Simulated Gating)

**Real enforcement is deferred** (production concern). For the MVP, roles drive
**which views, actions, and data a simulated user sees** — validated through an
in-app role/tier/team switcher. Derived from §5.

## Approach

- A **simulated identity** (extending GGX's `AuthContext` demo-user pattern)
  carries `role`, `supportTier`, and `teamId`. A dev switcher lets reviewers
  view the app as any role.
- **Central role-gating helpers** (small, plain functions/hooks — **not** a
  custom permissions framework) decide nav visibility and action availability.
- Gating is **UI-only**. Real server-side enforcement is a productionization
  requirement, noted so it is not forgotten but not built now.

## Roles

Guest · GGX Customer · **L1 Agent** (Support agent + L1 folded into one; tier is
an attribute) · L2/Specialist · Team Lead · KB Editor · Admin. The
"System/integration account" is **not** a UI role in the prototype.

## Capability matrix

Legend: ✅ full · 🔸 scoped (own/team) · — none

| Capability | Guest | GGX Customer | L1 Agent | L2/Specialist | Team Lead | KB Editor | Admin |
|---|---|---|---|---|---|---|---|
| Browse/search public KB | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| View internal KB | — | — | ✅ | ✅ | ✅ | ✅ | ✅ |
| Submit ticket | ✅ | ✅ | ✅ | ✅ | ✅ | — | ✅ |
| View own ticket (portal) | 🔸 link | 🔸 own | — | — | — | — | — |
| Reply as requester | 🔸 link | 🔸 own | — | — | — | — | — |
| View queue/team tickets | — | — | 🔸 team | 🔸 team | 🔸 team | — | ✅ |
| View all tickets | — | — | — | — | — | — | ✅ |
| Reply / internal note | — | — | 🔸 assigned | 🔸 assigned | 🔸 team | — | ✅ |
| Assign / reassign | — | — | 🔸 self-claim | 🔸 self-claim | 🔸 team | — | ✅ |
| Change classification | — | — | 🔸 | 🔸 | 🔸 team | — | ✅ |
| Escalate L1→L2 | — | — | ✅ | — | ✅ | — | ✅ |
| De-escalate / return | — | — | — | 🔸 | ✅ | — | ✅ |
| Resolve / close | — | — | 🔸 assigned | 🔸 assigned | 🔸 team | — | ✅ |
| Reopen | 🔸 link | 🔸 own | 🔸 | 🔸 | 🔸 team | — | ✅ |
| Create/edit KB draft | — | — | — | — | — | ✅ | ✅ |
| **Publish KB** | — | — | — | — | — | ✅ | ✅ |
| View reports | — | — | — | — | 🔸 team | — | ✅ |
| Configure routing/SLA | — | — | — | — | — | — | ✅ |
| Manage agents/roles | — | — | — | — | — | — | ✅ |
| View audit log | — | — | — | — | 🔸 team | — | ✅ |
| Admin settings/brand | — | — | — | — | — | — | ✅ |

## Enforced UI rules

- **Internal notes are never rendered in requester-facing views** (portal, public
  KB, contact). This is enforced at the entity level too — see
  [`mock-data-model.md`](mock-data-model.md).
- A simulated L1 agent **cannot see** admin areas, other teams' tickets, or
  internal-only surfaces outside scope.
- Nav sections and per-ticket actions are hidden/disabled per this matrix; a
  per-role review pass is part of Milestone 11.
