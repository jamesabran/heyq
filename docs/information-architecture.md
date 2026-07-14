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

AUTHENTICATED HOME (every signed-in role)
  /app                      Overview — role-adaptive default landing (M19)

AGENT WORKSPACE (simulated agent / L1 / L2 / lead)
  /app/mine                 My queue (assigned to me)
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
| source | `web` \| `email` \| `transaction` \| `api` \| `internal` (`internal` added in Phase 2 / M16) |
| brand | GGX (only active brand in MVP) |
| concernType | **Phase 2 / M15** — controlled triage descriptor, **separate** field (see below) |

**Seed concern categories** (admin-editable in the mock, not final): General
inquiry, Account, Disbursal, Claims, Delivery, Pickup, Payment, COD, Returns,
Technical, Other.

See [`mock-data-model.md`](mock-data-model.md) for the full entity shapes and
[`product-rules.md`](product-rules.md) for the invariants these fields enforce.

## Phase 2 IA additions (planned — M13–M18)

These are planned changes to the IA once Phase 2 lands (see
[`roadmap.md`](roadmap.md) and §21 of the plan). No routes are removed.

### Concern Type (M15)

`concernType` is a **new, separate** classification field — distinct from
category, subcategory, status, priority, escalation state, and team. Controlled
values (seed, admin-editable): Delivery delay, Pickup issue, Missing parcel,
Damaged parcel, COD concern, Remittance concern, Payment issue, Booking issue,
Address correction, Account concern, General inquiry. It appears as a **column in
agent ticket tables** (`/app`, `/app/team`, `/app/unassigned`, `/app/escalated`,
`/app/sla`, `/app/search`). **Responsive:** on small screens it may move into the
primary ticket summary rather than being hidden.

### Transaction context in the ticket detail (M13)

The **left "context" pane** of `/app/tickets/:id` gains an inline **GGX
transaction panel** when the ticket links a transaction: tracking number,
shipment/delivery status, origin/destination, **masked** sender/recipient,
booking/pickup/delivery/latest-movement dates, shipping fee + charges, payment
method, payment status, COD amount + remittance status, exceptions/failed
attempts/returns/cancellation, plus **data source** and **last-updated
timestamp**. It has its own states: loading, invalid/unmatched tracking number,
transaction unavailable, stale data, manual refresh, permission/ownership
mismatch, and multiple matches (disambiguation). Ticket status, shipment status,
and payment/remittance status render as **three separate** status indicators.

### Add Ticket action + internal ticket creation (M16)

The agent ticket list gains an **Add Ticket / New Ticket** action opening a
creation flow (source incl. `Internal`; reporter/submitting employee; requester
details when external; Concern Type; category/subcategory; description; priority;
team/assignee; optional tracking number / transaction link; internal notes;
attachments; creator recorded in audit history). Internal tickets follow the
standard seven-status lifecycle; requester notifications are **off by default**
(see [`product-rules.md`](product-rules.md) rules 17–18).

### Role-based Overview dashboard as default landing (M19) — ✅ built

The **Overview** is the **default authenticated landing page**. As built:

```
AUTHENTICATED HOME (all signed-in roles — OVERVIEW_ROLES)
  /app                      Overview dashboard (role-adaptive default landing)

AGENT WORKSPACE (authenticated)
  /app/mine                 My Queue (assigned to me) — moved off the index
  /app/team                 Team / queue tickets
  … (unassigned, escalated, sla, search, views, notifications unchanged)
```

`/` and the `/app` index resolve to the **Overview**; **My Queue moved to
`/app/mine`** and keeps its sidebar entry. **Overview** sits in its own top
**Home** nav section (not "Agent Workspace" — a KB editor and a customer land
there too and work no queue); all other sidebar sections (Team/Unassigned/
Escalated/SLA/Search/Saved Views/Notifications, Supervisor, Knowledge Base,
Administration) are **unchanged** — direct navigation to every area is retained.

Agent queue filters (`status`, `priority`, `q`, `sort`) now live in the **URL**,
so an Overview counter deep-links to the exact filtered list it counts
(e.g. `/app/mine?priority=urgent`).

The Overview **adapts by role/team/permission scope** (requester, L1/L2 agent,
supervisor, admin, KB editor) and is **attention-first**: urgent, SLA at-risk/
breached, unassigned high-priority, escalations, reopened, and awaiting-action
work as **lists/tables**; scoped counters (open, assigned, unassigned, urgent,
SLA at-risk, SLA breached, resolved today) as **cards**; a chart only for a
genuine trend. Every counter/row **deep-links** to a filtered queue/search or the
ticket detail, and rows carry Concern Type, tracking number + shipment/payment
status (when available), priority, SLA state, assignee, and latest activity. A
**Create ticket / internal ticket** action appears where authorized. States:
loading, empty, error+retry, stale-data, no-work, and no-urgent-items. The full
ticket detail (`/app/tickets/:id`) remains the primary workspace. See §22 of the
plan and [`roadmap.md`](roadmap.md) M19.

> **Requester landing (resolved, D29):** the `customer` identity now gets a
> minimal authenticated home at `/app` scoped to **their own** tickets (mapped to
> seeded requester `req-seed-3`). Rows still open through the **secure link**
> (`/t/:token`) — the token portal remains the requester's ticket view, and a
> reference alone never grants access (rule #6). Guests keep the public help
> centre and the portal; they get no `/app` home.
