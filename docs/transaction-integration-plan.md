# Backend Transaction Lookup & Synchronization Plan (Milestone 17)

**Status:** Planning only — no backend is built or selected here. This is the
M17 deliverable: a written plan for resolving GGX transaction/payment/remittance
data behind the existing `transactionService` seam, so the frontend built in M13
does not change when a real backend lands. M18 implements it. Technology stays
deferred (§17 of the plan; decision D17/D25).

> **Guardrails preserved:** HeyQ stays a **standalone platform**; GGX systems are
> an **integration behind typed async services, never a runtime foundation**
> (product rules #11/#14). HeyQ must keep working when the integration is
> unavailable. Sender/recipient stay masked (#15). Shipment, payment, and
> remittance statuses stay **independent** of each other and of ticket status
> (#13).

## 1. The seam this plugs into

M13 shipped `src/app/services/transactionService.ts` as the single integration
point. A real backend reimplements these functions with the **same signatures
and return types** — no component, hook, or model change:

| Function | Today (mock) | Production (M18) |
|---|---|---|
| `getTransactionForTicket(id, viewerTeamId?)` | reads `data/catalog` | `GET /transactions/:id` (+ authz) |
| `lookupByTracking(query)` | substring match over seed | `GET /transactions/lookup?tracking=` |
| `refreshTransaction(id, viewerTeamId?)` | re-reads seed | `POST /transactions/:id/refresh` (force re-fetch) |

The discriminated results (`none` / `unavailable` / `permission_denied` /
`found{stale}`, and `invalid` / `multiple` / `found`) already model every state
the UI renders; the backend maps its responses onto them.

## 2. Lookup: tracking / transaction id → live data

- **Resolution order.** A ticket links a transaction by opaque
  `relatedTransactionId` (structured context, rule #14). When only a tracking
  number is known (contact form, agent search, integration), resolve it to a
  transaction id first, then fetch by id.
- **Cardinality.** Lookup returns **0 / 1 / many**. Many → `multiple` (the UI
  shows a disambiguation list; the agent picks and links one). 0 → `invalid`.
- **Source systems.** A transaction record is assembled from potentially three
  GGX systems: **shipment/OMS** (status, route, dates, exceptions), **payments**
  (method, payment status, fees/charges), and **remittance** (COD amount,
  remittance status). The backend composes them into the one
  `RelatedTransaction` contract; the frontend never fans out.

## 3. Synchronization, caching & staleness

- **Read-through cache.** HeyQ caches the composed transaction with its
  `lastUpdatedAt` (already in the contract). The frontend computes **stale** when
  `now - lastUpdatedAt > threshold` (mock uses 48h); production keeps the same
  field so the UI is unchanged.
- **Refresh semantics.** The manual **Refresh** action maps to a force re-fetch
  that bypasses the cache and re-composes from source, updating `lastUpdatedAt`.
- **Freshness strategy (to decide in M18):** cache TTL vs. event-driven
  invalidation (if GGX emits shipment/payment/remittance events). Either way the
  contract (a `lastUpdatedAt` + a `stale` flag) is stable; only the backend
  refresh trigger differs.
- **No coupling.** Cached transaction data is **display context**, never part of
  HeyQ's domain state. A ticket's workflow/escalation/SLA never read from it, so
  a stale or missing transaction can never corrupt HeyQ state (rule #13).

## 4. Masking & permission model (PII)

- **Mask at the boundary.** Sender/recipient are masked **server-side** before
  leaving the integration, exactly as the mock masks in the service (rule #15).
  The `RelatedTransaction` contract carries only `senderMasked`/`recipientMasked`
  — full PII never reaches the browser by default.
- **Ownership / access.** `permission_denied` is returned when the viewer's
  team/role isn't allowed to see a transaction (mock: `transactionAccess` map +
  `viewerTeamId`). Production enforces this **server-side** against real identity
  + the transaction's owning org/team; the client still just renders the
  mismatch state.
- **Unmask (future, optional).** If a role ever needs full PII, model it as a
  separate audited endpoint — not by widening the default contract.

## 5. Reconciling the three independent statuses

- Shipment (`ShipmentStatus`), payment (`PaymentStatus`), and remittance
  (`RemittanceStatus`) are sourced from **different systems** and can legitimately
  disagree (e.g. `delivered` + `paid` + `pending` remittance = "COD collected,
  not yet remitted"). The backend must **not** collapse them into one status.
- Reconciliation logic (e.g. flagging "paid but no booking", "COD mismatch")
  lives in the composition layer as **derived exceptions** (`exceptions[]`), not
  by mutating any of the three statuses.

## 6. Error, permission & multiple-match handling

| Condition | Result surfaced | UI |
|---|---|---|
| Source system down / timeout | `unavailable` | "Transaction unavailable — try refresh" |
| Unknown tracking / id | `invalid` (lookup) / `unavailable` (by id) | inline notice |
| Not permitted | `permission_denied` | ownership-mismatch notice |
| >1 match | `multiple` | disambiguation list |
| OK, but old | `found` + `stale: true` | "Stale data" badge |

- **Degrade gracefully.** Every failure resolves to a defined state; the ticket
  remains fully usable without transaction data.
- **Timeouts/retries/circuit-breaking** live in the backend, invisible to the
  contract.

## 7. What M18 (production integration) then does

Reimplement the three `transactionService` functions against live GGX
shipment/payment/remittance systems, keeping signatures + the discriminated
results; add the composition + cache + masking + authz described above; verify
HeyQ still functions with the integration disabled. See
[`roadmap.md`](roadmap.md) M18 and §21.6 of the plan.

## 8. Open items (feed M18, non-blocking)

- Exact freshness strategy (TTL vs. events) and staleness threshold per status.
- Owning-org/team model for transaction authorization.
- Whether an audited full-PII unmask path is ever needed.
- Backend framework/database — still unselected (D17).
