# Information Architecture

Route tree, navigation, and the ticket classification model. All screens render
from mock data. Derived from §4 of the source-of-truth plan.

## Route tree

```
PUBLIC (simulated guest)
  /help                     Help center home (search, featured, categories)
  /help/c/:category         Category / subcategory listing
  /help/a/:slug             Article view (related, last-updated)
  /help/search              Search results
  /contact                  Submit a ticket (public form)
  /t/:token                 Requester ticket portal (simulated secure-link / token)

AGENT WORKSPACE (simulated agent / L1 / L2 / lead)
  /app                      My queue (assigned to me)
  /app/team                 Team / queue tickets
  /app/unassigned           Unassigned pool
  /app/escalated            Escalated tickets (filtered by escalation state/history, NOT status)
  /app/sla                  SLA at-risk / breached
  /app/tickets/:id          Ticket detail (3-pane: context | conversation | actions)
  /app/search               Global search & filters
  /app/views                Saved views

SUPERVISOR (simulated team lead)
  /app/supervisor           Team dashboard, workload, SLA compliance
  /app/reports              Operational reports

KB MANAGEMENT (simulated kb-editor / admin)
  /admin/kb                 Article list (draft/published), categories, ordering, revisions

ADMINISTRATION (simulated admin)
  /admin/agents             Agent enrollment, roles, teams, tiers, activation
  /admin/teams              Teams / queues
  /admin/routing            Routing rules (concern → team/tier)
  /admin/sla                SLA policies, business hours
  /admin/categories         Concern taxonomy management
  /admin/settings           Brand (GGX active), notification prefs, demo settings
  /admin/audit              Activity/audit log viewer (simulated)
```

## Route groups → layouts

- **Public group** (`/help`, `/contact`, `/t/:token`) — mobile-friendly public
  layout; no authenticated chrome.
- **App group** (`/app/*`) — agent workspace shell (header + sidebar + content).
- **Admin group** (`/admin/*`) — admin shell (shares chrome; admin nav section).

Routing uses React Router 7 (`createBrowserRouter`), mirroring GGX Corporate's
`src/app/routes.tsx`. Milestone 1 stands up only the shell and a validation
route; the full tree is built out across Milestones 2–9.

## Global navigation chrome (authenticated areas)

- **Header:** brand mark, global search entry, notifications bell, simulated
  identity switcher (role/tier/team), theme toggle, and the **disabled brand
  selector** (shows "GGX" active + locked "More brands coming soon").
- **Sidebar:** section groups gated by simulated role (Queues, Supervisor, KB,
  Administration). Nav visibility follows the role matrix in
  [`roles-and-ui-permissions.md`](roles-and-ui-permissions.md).
- **Content:** page area with `PageHeader` + breadcrumb pattern reused from GGX.

## Ticket classification model (kept explicit)

Every ticket carries these as **distinct fields** (never one generic "type"):

| Field | Values / note |
|---|---|
| category + subcategory | Admin-editable taxonomy (seed below) |
| supportTier | `L1` \| `L2` |
| queue / teamId | Owning team/queue |
| priority | required |
| severity | optional |
| status | New \| Open \| In Progress \| Pending Requester \| Resolved \| Closed \| Reopened |
| escalationState | `none` \| `escalated` \| `returned_to_l1` — **separate from status** |
| resolutionType | flag (e.g. resolved / duplicate / spam / cancelled) |
| source | `web` \| `email` \| `transaction` \| `api` |
| brand | GGX (only active brand in MVP) |

**Seed concern categories** (admin-editable in the mock, not final): General
inquiry, Account, Disbursal, Claims, Delivery, Pickup, Payment, COD, Returns,
Technical, Other.

See [`mock-data-model.md`](mock-data-model.md) for the full entity shapes and
[`product-rules.md`](product-rules.md) for the invariants these fields enforce.
