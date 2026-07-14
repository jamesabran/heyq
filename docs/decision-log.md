# Decision Log

Key decisions and their rationale. Newest first. Full context lives in the
source-of-truth plan; this is the durable index of *what was decided and why*.

| # | Decision | Rationale |
|---|---|---|
| D1 | **Frontend-first mock MVP** on the GGX Corporate stack | GGX already proves the high-fidelity-SPA-over-mock-service approach and ships helpdesk-adjacent screens; lowest-risk path to validate scope before backend investment. |
| D2 | **GGX Corporate + GGX SHADCN are the only references** | Corrected direction; avoids coupling the MVP to any external backend/platform architecture. |
| D3 | **7 ticket statuses, not 12** (New, Open, In Progress, Pending Requester, Resolved, Closed, Reopened) | Lean, real workflow; extra states (Cancelled/Duplicate/Spam/Pending-internal) are resolution types/flags, not statuses. |
| D4 | **Escalation is a separate dimension from status** | A ticket can be `In Progress` while `escalated`; the Escalated view filters on escalation history, not status. Prevents conflation that plagues flat models. |
| D5 | **Keep classification fields separate** (category/subcategory/tier/queue/priority/status/escalation/resolution/source/brand) | Avoids inheriting GGX's flat Zendesk-facade shape; lets a real API adopt the model cleanly. |
| D6 | **Manual claim + rules-based team routing** for MVP | Round-robin/workload routing deferred; keeps routing simple and demonstrable. |
| D7 | **Priority required, severity optional; one simulated business-hours calendar** | Right-sizes SLA modeling for a prototype. |
| D8 | **Requester access = simulated secure link / token** (`/t/:token`) | A reference alone must not grant access; contract leaves room for future reference-plus-token or authenticated model. |
| D9 | **Internal notes are a distinct entity, never in requester views** | Enforced at the type level, not just the UI, so leakage is structurally prevented. |
| D10 | **Components access data only via typed async services**; add a thin query/mutation seam | Services are the single future-API integration point; the query seam makes the mock→real swap mechanical. GGX calls services directly — the seam is HeyQ's one deliberate addition. |
| D11 | **QuadX red as a token layer over GGX `tokens.json`**, not a component fork | Components already read `--primary`; theming stays in tokens. |
| D12 | **Brand red must be distinct from `destructive`** | GGX `destructive` is already red (`#d4183d`); brand and danger must never visually collide. Both validated WCAG AA in light/dark. |
| D13 | **Dark mode requires extending the GGX token pipeline** | GGX emits `:root` (light) only and has no theme toggle; M1 adds a dark token set, a `.dark` build-script block, and a minimal `ThemeContext`. |
| D14 | **GGX-only; brand switcher shown as disabled UI** | Previews the multi-brand future without building tenant infrastructure; a `brand` field appears only where it prevents rework. |
| D15 | **Add a minimal test runner (Vitest + Testing Library)** | GGX ships no unit/component test setup; justified frontend-only addition for critical-flow smoke tests. |
| D16 | **HeyQ will be a standalone platform independent of Zendesk** (settled requirement) | Must work completely with zero migrated data; Zendesk never becomes a runtime dependency. |
| D17 | **Production backend technology is NOT selected yet** | Deferred to post-MVP backend planning; the org's existing platform patterns may be evaluated as *one* reference, committed to none. |
| D18 | **Avoid overengineering** — no microservices, DI, repository pattern, event bus, generic workflow/rules engine, plugin system, custom design system, or custom permissions framework | Prefer GGX conventions, plain TS models, small mock services, focused hooks, straightforward workflow functions, and component composition. |

## Phase 2 planning decisions (M13–M16 built; M17–M18 planned)

Direction for the post-MVP phase. D19–D24 are **implemented** in the frontend/mock
milestones (M13–M16); D25 (backend) stays planned. See [`roadmap.md`](roadmap.md)
M13–M18 and §21 of the plan.

| # | Decision | Rationale |
|---|---|---|
| D19 | **GGX transaction context renders inline in the ticket detail's left pane** via an expanded typed `RelatedTransaction`, behind `transactionService` | Reduces agents switching to a separate GGX system; keeps the data behind the existing typed-service seam so real GGX plugs in later without frontend redesign. |
| D20 | **Ticket status, shipment/delivery status, and payment/remittance status are three independent dimensions** | A support-status change must never mutate shipment or payment state; conflating them would repeat the flat-model debt D4/D5 warns against. |
| D21 | **Sender/recipient PII is masked at the service boundary** | Masking is a data-contract concern, not a per-view afterthought; the future real API must uphold it too. |
| D22 | **Concern Type is a new, separate `concernType` field** — not a merge of category/status/priority/etc. | Fast triage descriptor for the queue table; keeping it separate preserves the classification discipline of D5/rule #1. |
| D23 | **Internal tickets reuse the native ticket model** with `source: 'internal'` + a communication config; **no separate model or lifecycle** | Same seven-status flow (D3); avoids a parallel model and the drift it causes. Requester notifications default off for internal tickets. |
| D24 | **Theme refinement is a token-layer change** — darker/less-saturated primary (possible burgundy), a new secondary accent (blue/teal), and a broader status palette so statuses don't all rely on red | Fixes the too-bright `#E11900` without forking components (consistent with D11); keeps brand red distinct from `destructive` (D12). Final shade provisional pending visual review (A6). |
| D25 | **Backend transaction lookup/sync (M17) is planned, and production GGX integration (M18) is built, strictly behind the service seam** | GGX transaction/payment/remittance systems are **integrations, never a runtime foundation** (D16/§17); HeyQ must still function if they are unavailable. Backend technology stays unselected (D17). |
| D26 | **Role-based Overview dashboard (M19) becomes the default authenticated landing** at `/app`; My Queue moves to `/app/mine`; all other nav is retained | An actionable, attention-first summary is more useful as a landing than a single queue; keeping every existing route/nav entry avoids disruption. |
| D27 | **The Overview is one role-branching page composed from existing services** (`reportsService` + `ticketService` + filters/components) — **no widget system, no per-user customization, no new data model or dependency** | Honors the guardrails and D18 (no overengineering); reuse keeps the dashboard consistent with the queues and scope-safe by construction (rule #19). |
| D28 | **Dashboard summarizes and links; it never embeds the 3-pane workspace** — cards for counters, lists/tables for work, charts only for a real trend | Keeps `/app/tickets/:id` the single place complex handling happens (rule #20); prevents the dashboard from becoming a parallel workspace. |
| D29 | **Requester Overview is conditional on a minimal authenticated `customer` home** scoped to their own tickets; otherwise deferred (portal stays the requester surface) | The MVP requester experience is the token portal, not an authenticated `/app` area; flagged as a product decision rather than silently building a new auth surface (§22.6). **Resolved at build (M19): confirmed — built.** The `customer` identity gets an `/app` home over its **own** tickets (`Identity.requesterId` → seeded requester), but rows still open through `/t/:token`; the portal stays the requester's ticket view and rule #6 is intact. |

## Milestone 19 implementation decisions

| # | Decision | Rationale |
|---|---|---|
| M19.1 | **`overviewService` is a thin aggregator returning one of three discriminated shapes** (`tickets` \| `kb` \| `requester`), branching on role — not a per-role service or a widget config | One page, one seam. The role branch lives in the service (testable without React) while the page just renders the shape it is handed. Satisfies D27 with no new data model. |
| M19.2 | **Agent queue filters moved into the URL** (`status`, `priority`, `q`, `sort`); added a `priority` filter to `listTickets` + the queue UI | "Every counter deep-links to the list it counts" (D28) is only true if a filtered queue is addressable. The filter state was component-local, so a counter could not link to it. Also makes any queue view shareable. |
| M19.3 | **A new `AttentionTable`, rather than extending `TicketTable`** | The Overview row must carry GGX transaction context (tracking + shipment/payment + stale marker, M13) that the queue table deliberately does not show. Extending `TicketTable` with optional columns would have complicated every queue for one caller. |
| M19.4 | **Overview lives in its own "Home" nav section**, not under "Agent Workspace" | A KB editor and a customer land there and work no queue; filing their home under an agent heading would misdescribe it. |
| M19.5 | **Two seed adjustments**: `tkt-seed-8` reassigned to `req-seed-3` (so the `customer` demo has an awaiting-reply ticket) and a new `tkt-seed-15` resolved earlier on the simulated day | Without them two acceptance states are undemonstrable: the requester's "awaiting your reply" list, and a non-zero **Resolved today** counter (the simulated clock is fixed at 2026-07-14T09:00Z, and no seeded ticket resolved that day). |

## Milestone 20 implementation decisions

| # | Decision | Rationale |
|---|---|---|
| D30 | **The audit log is a read-only *view* over history the app already records** — no new audit writes, no new event types, no audit data model | Status events, assignments, escalations, internal notes, and KB revisions have been recorded since M6–M7 but were only visible inside one ticket's timeline. The gap was the viewer, not the data — so `auditService` derives the trail and stays correct automatically as new actions happen. |
| D31 | **The trail records the action, never an internal note's body** | Product rule #5 keeps note content on the ticket, where the rules governing who may read it already live. An audit row says *"Internal note added"* and links to the ticket; it does not become a second, weaker-governed copy of note content. Asserted by test. |
| D32 | **Actor names resolve via the agent roster, falling back to `ROLE_LABELS`** | The KB editor edits articles but is not a support agent, so she is absent from `agents`. Rather than add a non-agent to the agent roster (which would pollute assignee pickers and the agent admin screen), the audit layer degrades to the role label. |

## Ticket-field & state-presentation rework (M21)

| # | Decision | Rationale |
|---|---|---|
| D33 | **"Pending Requester" → `on_hold` + `holdReason`** (waiting for requester / internal team / third party, scheduled follow-up, other) | Being blocked is one state; *who* we are blocked on is a property of it. The old status could only express one of the five real reasons, so agents had no way to say "waiting on the hub" except in a note. Migration: every seeded `pending_requester` ticket became `on_hold` + `waiting_requester`, preserving its exact meaning. |
| D34 | **"Reopened" is an event/flag (`reopenedAt`), not a status** — a reopened ticket returns to `open`, or `in_progress` if it still has an owner | "Reopened" answered *what happened to this ticket*, while the other statuses answer *what state is it in now* — mixing the two meant a reopened ticket in active work still read as "Reopened" forever. Queues, counters, and the Overview now filter on the flag (`?reopened=1`), so nothing was lost. |
| D35 | **The resolution SLA clock pauses on hold only for EXTERNAL blockers** (requester, third party, scheduled follow-up) — not `waiting_internal` | Preserves the old Pending Requester pause exactly, and makes the new reasons explicit. Pausing the clock when we are blocked on *our own* team would hide precisely the delay an SLA exists to surface. |
| D36 | **Priority drops `low`** → Normal / High / Urgent | Nothing in the workflow keyed off `low`; it existed only as a fourth pill for the eye to decode. The one seeded low-priority ticket became `normal`. |
| D37 | **Status, priority, and SLA are deliberately unequal in visual weight** — status always subtle; Normal priority is plain text and only Urgent is a red pill; On Track is muted text and only At Risk/Breached are badges | Three equally loud pills per row means none of them signals anything. The row is now calm by default and loud only when something genuinely needs action. Colour is never the sole signal — every state keeps its label. |
| D38 | **Brand colour is removed from status.** In Progress is blue (`info`), not brand red; no status maps to `destructive` | Brand colour is for actions, nav, links, and selection. A ticket being worked on is not an error, and red must keep meaning urgent/breached/failed. Asserted by test. |
| D39 | **One shared `TicketTable`; `AttentionTable` deleted.** The Overview passes an optional per-row transaction context to light up the extra shipment/payment columns | Two tables meant two definitions of how a status, priority, or SLA looks. Now the queues, saved views, search, and the Overview render ticket state through exactly one component, and the only difference is columns the queues don't need. |
| D40 | **Tracking numbers use `XXXX-XXXX-XXXX` and are denormalized onto `TicketListItem`** | The number lives on `RelatedTransaction` (rule #14 — linkage stays structured), but every table needs it; resolving it per-row in the view layer would have meant a service call per row. It stays visibly distinct from a `HQ-2026-0003` ticket reference. |

## Browser smoke verification (M21 checkpoint)

| # | Decision | Rationale |
|---|---|---|
| D41 | **Added Playwright (Chromium only) as a smoke suite, not a visual-regression suite** — no pixel diffs, no snapshot baselines | The jsdom tests cannot catch layout: they have no viewport and no real CSS. A smoke pass at three widths answers "does it render, behave, and not overflow" — which is where the real bugs were. Pixel-diff baselines would fail on every copy change and get muted, which is worse than not having them. |
| D42 | **The overflow assertion targets the page body, not tables** | Wide tables are *supposed* to scroll inside their own container. Asserting `documentElement.scrollWidth` catches the actual defect (the user panning the whole page sideways) without banning the intended pattern. |

## Milestone 11 implementation decisions

| # | Decision | Rationale |
|---|---|---|
| M11.1 | **Semantic tokens everywhere; the only literal color is the modal scrim (`bg-black/40`)** | A scrim reads correctly in both themes; everything else theme-switches via tokens, so dark mode is complete by construction. |
| M11.2 | **Responsive strategy = stack + internal scroll** (tables in `overflow-x-auto`, panes collapse below `lg`) | No horizontal page overflow at mobile; verified on the widest views. |
| M11.3 | **A11y: skip link, `main#main-content`, `aria-expanded`/`aria-controls` on the nav toggle, Escape-closes-sidebar** | Standard landmark + keyboard affordances on top of the existing focus-visible rings and labelled controls. |

## Milestone 10 implementation decisions

| # | Decision | Rationale |
|---|---|---|
| M10.1 | **One reusable `ErrorState` + `useQuery.refetch` retry**, wired into every data view | Uniform error handling with minimal per-page code; the error branch was the one state most pages were missing. |
| M10.2 | **No artificial failure toggles in production code** | Error wiring is proven by a `useQuery` reject test; the app doesn't fake failures. |

## Milestone 9 implementation decisions

| # | Decision | Rationale |
|---|---|---|
| M9.1 | **`notificationService.emit` is a sync call from ticketService actions**, with dedup + mute prefs | One core event → one notification; mirrors a backend-emitted event as a demo stand-in. Dedup on (recipient, event, ticket) within a 3 s window. |
| M9.2 | **Dependency-free CSS bar charts instead of Recharts** | The plan suggested Recharts, but "simple counters + charts" is fully met by lightweight token-styled bars — avoids a dependency + bundle cost (guardrail: minimal deps). Trivial to swap to Recharts later if richer charts are wanted. |
| M9.3 | **"Email sent" = an `emailed` flag on the notification**, shown as a badge | Demonstrates the requester-email marker inside an agent-visible surface without a separate delivery model. |
| M9.4 | **Shared `Dashboard` for reports (all) and supervisor (team-scoped)** | `reportsService.getSummary(teamId?)` powers both; no duplicated dashboard. |
| M9.5 | **Notification bell shown only in the authenticated shell** | Guests/public pages have no agent feed. |

## Milestone 8 implementation decisions

| # | Decision | Rationale |
|---|---|---|
| M8.1 | **`slaService` reads editable `slaConfig`** instead of constants | Makes SLA admin edits flow through to badges — the "reflects downstream" acceptance. |
| M8.2 | **Routing rules edit each category's `defaultTeamId`** | Reuses the M4 routing mechanism (no separate rules table/engine); routing admin and taxonomy admin edit different fields of the same category. |
| M8.3 | **Config writes mutate catalog module state** via `adminService` | Same mock pattern as tickets; changes are visible session-wide (reset on reload, A2). |
| M8.4 | **`/admin/settings` + `/admin/audit` stay placeholders** | Settings (brand/notif/demo) and a global audit viewer aren't M8 deliverables; audit fits with M9 notifications/reporting. |
| M8.5 | **Category add + reassign only** (no rename/delete) | Covers "configures taxonomy" with the least surface; destructive/rename ops aren't needed for the acceptance. |

## Milestone 7 implementation decisions

| # | Decision | Rationale |
|---|---|---|
| M7.1 | **Admin reads are separate, unfiltered functions** (`listAllArticles`, `getArticleForEdit`) | Editors need drafts/internal; public reads still filter to published+public in one place (product rule #5) — so publishing an internal article still never surfaces it publicly. |
| M7.2 | **`updateArticle` snapshots the previous title/body as a `KbRevision`** | Simple, honest revision history without a diffing engine. |
| M7.3 | **Publish/visibility are explicit service actions**, not free-form status edits | Keeps the lifecycle controlled and mirrors intended endpoints. |
| M7.4 | **Nested `/admin/kb` routes** (list / new / :id) | Standard list+editor flow; create navigates to the new article's editor to publish. |
| M7.5 | **KB category CRUD deferred to M8** (taxonomy admin) | M7 authors articles against existing categories; category management belongs with the other admin surfaces. |

## Milestone 6 implementation decisions

| # | Decision | Rationale |
|---|---|---|
| M6.1 | **Escalation changes state/tier/team/owner + appends history; status untouched** | Product rule #2 — enforced in `escalateTicket` (status line deliberately not changed) and verified in-browser. |
| M6.2 | **Escalation takes a target team/owner param** (no fixed "L2 team" model) | Teams aren't tiered in the mock; letting the escalator pick the specialist team/owner is flexible and matches the acceptance without restructuring teams. |
| M6.3 | **Re-routing = set team to the new category's `defaultTeamId`** on category change (opt-in checkbox) | Demonstrates rules→team routing without a rules engine; respects manual team choices when unchecked. |
| M6.4 | **Assignment + escalation merged into the timeline; classification-change audit deferred to M9** | Covers the §14 assignment/escalation audit now; a full audit entity/log is M9. |
| M6.5 | **Mandatory escalation note enforced in the service** (`escalateTicket` throws) and the UI (disabled button) | Belt-and-suspenders so history is always meaningful. |

## Milestone 5 implementation decisions

| # | Decision | Rationale |
|---|---|---|
| M5.1 | **Fixed simulated clock** (`lib/clock.ts`, anchored 2026-07-14) | SLA states must be deterministic regardless of real wall-clock; advanceable-clock demos deferred (docs/sla-simulation.md). |
| M5.2 | **Simplified SLA** (targets 4h/48h, wall-clock elapsed, pause on Pending Requester) | Enough for badges now; business-hours accuracy + per-priority policies are M8. Marked provisional. |
| M5.3 | **`InternalNote` is a distinct entity**; `listMessages`/portal expose only `TicketMessage` | Structurally prevents notes leaking to requesters (product rule #5) — verified in agent view vs portal. |
| M5.4 | **Queues scoped by identity** (`viewerId`/`viewerTeamId`); admin (no team) sees all | Matches the role matrix without a permissions engine. Aligned identity `teamId`s to catalog team ids. |
| M5.5 | **Escalated queue filters on escalation state, not status** | Product rule #2; the seeded escalated ticket stays `in_progress`. |
| M5.6 | **Reply/note/resolve now; assign/escalate/classify deferred to M6** | Keeps M5 to the core work-a-ticket loop; right pane notes where M6 controls land. |
| M5.7 | **Shared `AgentQueuePage` + thin wrappers; view models composed in the service** | Avoids duplicated list pages; components stay presentational. |

## Milestone 4 implementation decisions

| # | Decision | Rationale |
|---|---|---|
| M4.1 | **Routing = category `defaultTeamId`** (no rules engine) | Smallest correct routing for "lands in the right team's queue"; admin rule overrides deferred to M6/M8 (avoids a generic engine, D18). |
| M4.2 | **Access token is the only portal key**; reference never resolves | Enforces product-rule #6 in `requesterService.resolveAccessToken` — a reference passed to `/t/:token` returns "not found". |
| M4.3 | **Requester description seeds the first public message + a system ack** | Gives the portal a sensible initial thread; mirrors a real intake acknowledgement (simulated). |
| M4.4 | **Reply transitions: Pending Requester→In Progress, Resolved→Reopened**; explicit Reopen for Resolved/Closed | Matches the lifecycle in the plan without building Closed→follow-up linking (deferred, provisional). |
| M4.5 | **Attachments are metadata-only** (name/size/type), validated client-side | No upload/storage in the mock MVP; file bytes are never read/sent. |
| M4.6 | **`useMutation` is variadic** over the service function's args | Lets it wrap `addRequesterMessage(id, body)` and `createTicket(input)` uniformly. |
| M4.7 | **Added `authorName` to `TicketMessage`; standalone `RelatedTransaction` with requester fields** | Display convenience + transaction prefill; additive, harmless. |

## Milestone 3 implementation decisions

| # | Decision | Rationale |
|---|---|---|
| M3.1 | **`useQuery` implemented; `useMutation` deferred** | M3 is read-only; adding a mutation hook now would be speculative (D18). It lands with the first writes (M4). |
| M3.2 | **Public visibility filtered inside `kbService`** (published + public only) | Enforces product-rule #5 in one place — internal/draft articles can't leak to any public consumer, incl. search and direct slug access. |
| M3.3 | **KB `models` + `data` + `service` split; components use the service only** | Product-rule #7 (typed async services, no direct seed access) and the future-API seam. |
| M3.4 | **Dependency-free `ArticleBody` mini-renderer** (`## ` / `- ` / `**`) | Readable article structure without pulling in a markdown parser (avoid premature dependency). |
| M3.5 | **Added `excerpt`, `featured`, category `icon`** beyond the doc's abbreviated fields | Needed for cards, the featured row, and the category grid; harmless additive fields. |
| M3.6 | **~160 ms simulated latency, skipped under test** | Makes loading states visible in the app while keeping the suite fast/deterministic. |

## Milestone 2 implementation decisions

| # | Decision | Rationale |
|---|---|---|
| M2.1 | **D10 resolved: thin in-house query/mutation wrapper** (not a library), **implemented later** | M2 renders placeholders with no data reads; building a query layer now would be speculative (D18). Decision recorded; implementation lands in M3 with the first `kbService` read. |
| M2.2 | **Single nav config (`config/navigation.ts`) + shared role groupings (`lib/roles.ts`)** drive both sidebar visibility and `RequireRole` route guards | One source of truth so nav and access can't drift. |
| M2.3 | **`RequireRole` renders an "access restricted" placeholder, not a redirect** | Keeps every area reachable by switching identity — better for a demo/review flow than bouncing the URL. |
| M2.4 | **Native `<select>` identity switcher** | Fully accessible with minimal code; avoids adding a popover/menu dependency for a dev-only control. |
| M2.5 | **`routes.tsx` exports a `RouteObject[]`; browser router built in `main.tsx`** | Lets tests drive the real tree via `createMemoryRouter`. |
| M2.6 | **`/`, `/*` → `/app`; `/admin` → `/admin/kb`** | Sensible defaults; admin's landing is the KB area both KB editors and admins share. |

## Milestone 1 implementation decisions

| # | Decision | Rationale |
|---|---|---|
| M1.1 | **Provisional QuadX red = `#E11900`** (scarlet), a single scalar in `tokens.json` | Clearly distinct hue from destructive crimson `#D4183D`; white foreground meets AA on the fill (~4.8:1) in both modes. Reversible in one place pending Brand sign-off (A6). |
| M1.2 | **Re-authored vendored primitives against semantic tokens** rather than copying GGX's hardcoded grays | GGX primitives are light-only (`bg-white`, `border-gray-200`); HeyQ requires working dark mode, so primitives read `--card`/`--border`/`--foreground` etc. Keeps HeyQ standalone. |
| M1.3 | **Token pipeline emits both `:root` and `.dark`** from `color.light`/`color.dark`, with a sync guard | Closes the GGX gap (light-only). The guard throws if the two sets drift. |
| M1.4 | **Separate `vitest.config.ts` (no plugins)** from `vite.config.ts` | Vitest 2.1 resolves its own bundled Vite 5; isolating test config avoids a Vite version/type clash while the app build stays on Vite 6. |
| M1.5 | **Layout components (Header/Sidebar/PageHeader) are local, not "primitives"** | They are app composition, not reusable design-system atoms; keeps the vendored `ui/` set minimal. |
| M1.6 | **Deferred M1 scope**: no query/mutation layer, no mock services, no full route tree | Not needed to prove the foundation; avoids speculative abstraction (D18). |

## Deferred decisions (need input, non-blocking)

See [`session-state.md`](session-state.md) for the live open-questions list
(taxonomy A3, SLA targets A4/A5, **final** QuadX red value A6, identity model,
reporting depth). None blocked Milestone 1.
