# Backend-Readiness Assessment (Milestone 12)

The frontend-first MVP is complete (M1–M11). This document is the gate to backend
planning: it inventories the **API seams** the prototype was built against, the
**typed contracts** a real backend must satisfy, and what productionization
requires. It commits to **no backend technology** — see the deferral note below.

> **Status:** Ready for stakeholder review / sign-off to proceed to backend
> planning. No backend is built or selected here.

## 1. How the frontend is wired for a backend

Every screen reads and writes through **typed async service facades**
(`src/app/services/*`) — components never touch seed data directly. A thin
`useQuery` / `useMutation` hook layer isolates components from the data source, so
the mock→real swap is localized to the services. IDs/tokens are opaque strings;
all service functions are already `Promise`-returning, so loading/empty/error
states exist. This is the single integration seam (see
[`mock-service-layer.md`](mock-service-layer.md)).

**To connect a real API:** reimplement each service function to call the backend
(same signatures, same return types). No component, hook, or model changes are
required.

## 2. Service seam → intended endpoints

Each service documents its future endpoints in-code; consolidated here:

| Service | Intended endpoints (illustrative REST) |
|---|---|
| `kbService` | `GET /kb/categories`, `GET /kb/categories/:slug`, `GET /kb/categories/:id/articles`, `GET /kb/articles?featured\|q=`, `GET /kb/articles/:slug`, `GET /kb/articles/:id/related`; admin: `GET /kb/articles(all)`, `POST /kb/articles`, `PATCH /kb/articles/:id`, `POST /kb/articles/:id/publish\|unpublish`, `GET /kb/articles/:id/revisions` |
| `catalogService` | `GET /catalog/categories`, `GET /catalog/teams`, `GET /agents`, `GET /transactions/:id` |
| `ticketService` | `POST /tickets`, `GET /tickets/:id`, `GET /tickets?queue&filters`, `GET /tickets/:id/detail`, `GET /tickets/:id/messages`, `POST /tickets/:id/messages`, `POST /tickets/:id/notes`, `POST /tickets/:id/reopen`, `POST /tickets/:id/assign`, `PATCH /tickets/:id/classification`, `POST /tickets/:id/escalate\|de-escalate`, `POST /tickets/:id/resolve` |
| `requesterService` | `GET /portal/:token` (secure-link resolution) |
| `slaService` | (client compute today) → `GET /tickets/:id/sla` or embedded in ticket detail |
| `adminService` | `PATCH /agents/:id`, `POST /teams`, `POST /categories`, `PATCH /categories/:id`, `GET/PUT /sla-config` |
| `notificationService` | `GET /notifications?recipient`, `POST /notifications/read`, `GET/PUT /notification-prefs` |
| `reportsService` | `GET /reports/summary?team=` |

## 3. Typed contracts (the API shapes)

The shared `src/app/models/*` types are the proposed API payloads:
`Ticket`, `TicketMessage`, `InternalNote`, `StatusEvent`, `Assignment`,
`Escalation`, `Requester`, `RequesterAccess`, `RelatedTransaction`, `SlaSummary`;
`Team`, `TicketCategory`; `KbArticle`, `KbCategory`, `KbRevision`;
`Notification`. Invariants a backend must preserve (see
[`product-rules.md`](product-rules.md)): status ≠ escalation; the 7-status set;
internal notes as a separate, never-requester-facing entity; token-only portal
access; separate classification fields; `brand` present.

## 4. What is simulated → what a backend must provide

| Simulated in the MVP | Production requirement |
|---|---|
| Module-state "DB" reset on reload | Real persistence + API behind the §2 seams |
| Switchable identity, role-gated UI | Real auth + SSO + **server-side** role/permission enforcement |
| `resolveAccessToken` (opaque token) | Real secure-link/token issuance + validation |
| Email-origin tickets, "email sent" markers | Live email ingestion/delivery + threading |
| SLA via fixed simulated clock (4h/48h) | Persistent SLA timers, business-hours calendar, background jobs |
| Attachments = metadata only | File storage + malware scanning |
| In-memory notifications + dedup/prefs | Production notification delivery |
| Client-side search/filter | Search infrastructure at scale |
| Timeline/audit derived from state | Durable audit-log infrastructure |
| `relatedTransaction` seed | OMS / transaction API integration |

## 5. Standalone & Zendesk-independence (settled)

HeyQ will own its backend, database, auth, storage, notifications, audit, search,
and SLA processing, and must work with **zero** migrated Zendesk data. Zendesk is
never a runtime dependency. Migration, if ever approved, is a separate optional
data-onboarding effort; imported records become native HeyQ records. (§17/§19 of
the source-of-truth plan.)

## 6. Technology selection — deferred

The backend framework and database are **not** selected in this phase. The
organization's existing platform patterns may be evaluated as **one** reference
during backend planning; this MVP commits to none.

## 7. Readiness checklist

- ✅ All 12 milestones' frontend scope delivered; 90 tests, clean build.
- ✅ Every data path goes through a typed async service seam.
- ✅ Contracts (`models/*`) shaped for a real API; opaque IDs; async everywhere.
- ✅ Product invariants enforced in the mock (status≠escalation, internal-note
  isolation, token-only portal) — a backend must uphold the same.
- ⬜ **Open (feed backend planning, not blockers):** final concern taxonomy (A3),
  SLA targets + business hours (A4/A5), final QuadX red (A6), reviewer identity
  set, reporting depth. See [`session-state.md`](session-state.md).
- ⬜ **Sign-off:** stakeholder approval to proceed to backend planning.
