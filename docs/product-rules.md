# Product Rules (Invariants)

These rules are **non-negotiable invariants** for the HeyQ MVP. They hold in the
mock data model, the service layer, and every UI surface. Detail and rationale
live in the source-of-truth plan; this file is the short, enforceable list.

## Classification

1. **Category, subcategory, tier, queue, priority, status, escalation state,
   resolution type, source, and brand are separate fields.** They are never
   collapsed into a single generic "type." (Avoids inheriting GGX's flat
   Zendesk-facade shape.)
2. **Escalation is separate from ticket status.** A ticket's workflow status is
   independent of whether it is escalated. Escalation is its own dimension —
   `escalationState`, `supportTier`, `teamId`, `assigneeId`, reason, note,
   timestamp, and history — not a status value.

## Ticket status set (exactly 7)

3. Ticket status is one of: **New, Open, In Progress, Pending Requester,
   Resolved, Closed, Reopened.** "Cancelled", "Duplicate", "Spam", and "Pending
   internal action" are **resolution types / flags**, not statuses.
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
