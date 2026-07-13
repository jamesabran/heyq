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
