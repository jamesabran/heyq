# Product Rules (Invariants)

These rules are **non-negotiable invariants** for the HeyQ MVP. They hold in the
mock data model, the service layer, and every UI surface. Detail and rationale
live in the source-of-truth plan; this file is the short, enforceable list.

## Classification

1. **Category, subcategory, tier, queue, priority, status, escalation state,
   resolution type, source, brand — and (Phase 2) concern type — are separate
   fields.** They are never collapsed into a single generic "type." Concern Type
   is an **additional** triage descriptor alongside these, not a replacement for
   any of them. (Avoids inheriting GGX's flat Zendesk-facade shape.)
2. **Escalation is separate from ticket status.** A ticket's workflow status is
   independent of whether it is escalated. Escalation is its own dimension —
   `escalationState`, `supportTier`, `teamId`, `assigneeId`, reason, note,
   timestamp, and history — not a status value.

## Ticket status set (exactly 6)

3. Ticket status is one of: **New** (not yet reviewed), **Open** (reviewed, ready
   for action), **In Progress** (actively being handled), **On Hold** (temporarily
   blocked), **Resolved** (solution provided), **Closed** (finalized).
   "Cancelled", "Duplicate", "Spam", and "Pending internal action" are
   **resolution types / flags**, not statuses.
   - **On Hold carries an optional `holdReason`** — waiting for requester /
     internal team / third party, scheduled follow-up, or other. *Who* we are
     blocked on is a reason, not a separate status; this replaces the old
     "Pending Requester" status, which only expressed one of the five.
   - **Reopened is an event, not a status.** A reopened ticket returns to `Open`
     (or `In Progress` if it still has an owner) and carries `reopenedAt`; queues
     and the Overview filter on that flag. A ticket that has been reopened is
     still, plainly, in progress — its status should say so.
4. When an L1 ticket is escalated it typically **stays `In Progress`** while its
   `supportTier`, `teamId`, owner, and `escalationState` change. The **Escalated
   Tickets** view filters on escalation state/history, **never on status**.

## Visibility & access

5. **Internal notes must never appear in requester-facing views.** They are a
   separate entity type (`InternalNote`), visually distinct in agent views, and
   are never rendered in the requester portal or any public surface.
6. **Requester access is a simulated secure link / access token, not a ticket
   reference.** The portal route is `/t/:token`; a ticket **reference alone does
   not grant access**. The contract leaves room for a future
   reference-plus-token or authenticated-requester model.

## Data access discipline

7. **Components access data only through typed async mock services** — never
   directly from seed files. Services return Promises so loading/error states
   exist from day one.
8. **Mock contracts and service boundaries must allow future API replacement
   without redesigning the frontend.** IDs and references are opaque strings
   (never array indices); each service documents its intended future endpoints.

## Brand & theming

9. **GGX-only.** A future brand switcher is shown as **disabled UI only** (locked
   chip, "More brands coming soon"). No tenant routing or brand-scoped
   partitioning is built. A `brand` field may appear in mock models where it
   prevents later rework.
10. **QuadX brand red must be visually distinct from the `destructive` token**
    so "brand" and "danger" never collide. Both are validated for WCAG AA in
    light and dark. (Note: GGX `destructive` is already a red, `#d4183d`.)

## Scope discipline

11. **No production backend concerns** in the MVP: no database, server
    framework, auth SDK, or mail/queue/storage clients. All email, SLA timers,
    routing, notifications, attachments, audit, and transactions are
    **simulated** in the mock layer.
12. **HeyQ must remain independent of Zendesk.** No Zendesk runtime dependency
    or data source is introduced; the product must work completely with zero
    migrated data.

## Phase 2 invariants (planned — apply once M13–M18 are built)

These extend the rules above; they take effect as the corresponding Phase 2
milestones land (see [`roadmap.md`](roadmap.md) M13–M18) and never override
rules 1–12.

13. **Ticket status, shipment/delivery status, and payment/remittance status are
    three independent dimensions.** Changing the support **ticket status must
    never change** shipment or payment/remittance status, and vice versa. Each is
    displayed and reasoned about separately.
14. **A transaction reference is stored as structured ticket context, not text.**
    Linkage is `relatedTransactionId` + a typed `RelatedTransaction`, never only
    a tracking number embedded in the description. Transaction data is reached
    **only** through a typed async service (rule #7), and GGX systems are an
    **integration, never a runtime foundation** (rule #11/§17).
15. **Sender and recipient details are masked** wherever transaction context is
    shown; PII is not exposed in full in the agent view.
16. **Concern Type is a separate, controlled field** (`concernType`), distinct
    from category, subcategory, status, priority, escalation state, and team
    (see rule #1). It may surface in the ticket summary on small screens but is
    never merged into another field.
17. **Internal tickets use the same native ticket model** — a different `source`
    (`internal`) and communication configuration, **not** a separate model or a
    separate lifecycle. They follow the standard six-status lifecycle (rule #3).
18. **Requester notifications are disabled by default for purely internal
    tickets.** They are enabled only when an external requester is added **and**
    an agent explicitly turns requester communication on. Internal notes remain
    invisible to requesters in every case (rule #5).
19. **The Overview dashboard is scope-bound and reuse-only.** It renders only
    tickets/counters/actions the viewer is authorized to see (same role/team
    scoping as the queues), **adapts by role** (never one dashboard for all), and
    is composed from **existing** services, permissions, ticket models, filters,
    and UI components — **no new data model, widget system, or per-user
    customization**. Counters/rows are **links** into filtered queues/search or
    the ticket detail.
20. **The dashboard summarizes; it does not replace the workspace.** Complex
    ticket handling stays on the ticket detail page (`/app/tickets/:id`). The
    dashboard uses **cards only for counters/summaries** and **lists/tables for
    actionable work**, with **charts only for a genuine operational trend**.
    Direct navigation to Tickets/Queues, Knowledge Base, Reports, Notifications,
    and Administration is retained.

## Presentation of state (badge hierarchy & semantic colour)

21. **GGX tracking numbers use the format `XXXX-XXXX-XXXX`** — 12 uppercase
    alphanumeric characters in three hyphen-separated groups
    (`^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$`). A tracking number is **never**
    interchangeable with a HeyQ ticket reference (`HQ-2026-0003`): they are
    different identifiers for different things, and both are shown. A
    non-shipment ticket has no tracking number and displays an em dash.
22. **Ticket search matches partial or full values** across reference, tracking
    number, concern type, subject, requester name, and requester email.
23. **Brand colour never carries state meaning.** Brand is for primary actions,
    navigation, links, and selected states. State uses semantic colour: **red**
    for urgent / breached / destructive / failed, **amber** for high / at-risk /
    needs-attention, **green** for resolved / on-track, **blue** for open / active
    / in-progress / informational, **grey** for neutral / paused / closed.
    In Progress is therefore **blue, never red** — a ticket being worked on is not
    an error.
24. **Status, priority, and SLA are not three equally loud pills.** Status is
    always a subtle chip; priority shows Normal as plain text, High as restrained
    amber, and only Urgent as a strong red badge; SLA shows On Track as muted text
    and only At Risk (amber) and Breached (red) as badges. An ordinary row is
    calm — only urgent, at-risk, breached, or escalated work stands out.
    **Escalation gets its own labelled indicator** (icon + text + tooltip +
    accessible name), never an unexplained arrow, because escalation is a separate
    dimension from status (rule #2). **Colour is never the only signal** — every
    state keeps a readable text label.

## GGX Business+ linked orders (M22)

25. **Business+ is a context provider, never the system of record.** HeyQ owns
    the ticket and everything on it; Business+ supplies authenticated identity
    and authorized order context through the `OrderProvider` seam only.
    - **External IDs are reference data, never HeyQ primary keys.** A linked
      ticket stores `externalOrderId` + a minimal **snapshot captured at
      submission**, and stays fully usable from that snapshot when the provider
      is unavailable or the order is stale, missing, or deleted upstream.
    - **Authorization is enforced at the service boundary**, not the UI: linking
      an order outside the requester's user/organization scope fails the
      submission atomically. Cross-organization reads return `forbidden`.
    - **GGX shipment status and HeyQ ticket status are independent dimensions**
      (extends rule #13): a live shipment change never moves the ticket status,
      and no HeyQ action mutates a shipment.
    - **Linking is always optional.** The requester can submit without an order,
      and must still be able to when the provider is down. Manual and non-GGX
      flows are unchanged.
    - The token-scoped requester portal renders the **snapshot only** — it never
      calls the provider, so it cannot leak cross-organization data.
