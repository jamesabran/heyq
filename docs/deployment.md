# HeyQ deployment

HeyQ ships as **two independently deployed pieces** on **different domains**:

| Piece | What | Host | Example URL |
|---|---|---|---|
| Frontend | Vite/React static build | Vercel | `https://heyq.vercel.app` |
| API | Standalone Node mock API (`server/`) | Railway / Render (any Node host) | `https://heyq-api-production.up.railway.app` |

In local development a single Vite dev proxy forwards `/api` to the Node server,
so both run same-origin. In production they are cross-origin: the frontend is
built with `VITE_API_BASE_URL` pointing at the API domain, and the API allows the
frontend origin via CORS.

> The mock API keeps state **in memory** (no database). Restarts and multiple
> instances do not share state — run a **single instance** and expect state to
> reset on redeploy. This is unchanged from the local workflow.

## Environment variables

### Frontend (Vercel — build-time, must be prefixed `VITE_`)

| Variable | Required | Value | Notes |
|---|---|---|---|
| `VITE_API_BASE_URL` | Yes (prod) | API origin, e.g. `https://heyq-api-production.up.railway.app` | **No** trailing slash, **no** `/api` suffix. Requests resolve to `${VITE_API_BASE_URL}/api/...`. Leave unset locally to use the dev proxy. |

### Backend (Node host — runtime)

| Variable | Required | Value | Notes |
|---|---|---|---|
| `PORT` | Auto | Injected by the host | Server listens on it; binds `0.0.0.0`. |
| `HEYQ_API_PORT` | No | e.g. `4310` | Local fallback only, used when `PORT` is unset. |
| `HOST` | No | default `0.0.0.0` | Override the bind address if needed. |
| `HEYQ_FRONTEND_ORIGIN` | No | e.g. `https://heyq-preview.vercel.app` | Extra **agent** CORS origin(s), comma-separated. `http://localhost:18020` and `https://heyq.vercel.app` are always allowed. Agent origins may reach every route. |
| `HEYQ_BUSINESS_PLUS_ORIGIN` | No | e.g. `https://ggx-corporate.vercel.app` | Extra **customer** CORS origin(s), comma-separated. `http://localhost:18010` and `https://ggx-corporate.vercel.app` are always allowed. Customer origins may reach only the `public` customer surface (ticket reads + requester reply/reopen); agent/internal routes are refused with 403. |

### Route protection (no auth at this mock stage)

Each API route is `public` (the GGX Business+ customer surface) or `internal`
(agent app, order picker, portal token exchange, notifications, reports, audit).
A request to an `internal` route from a **known customer origin** is refused with
`403`. This is an origin-based boundary, not authentication — it exists so the
customer app cannot reach agent/internal endpoints. Server-to-server and test
callers send no `Origin` and are unaffected; the agent frontend is not a customer
origin. `public` routes: `GET /health`, `GET /customer/tickets`,
`GET /customer/tickets/:id`, `POST /customer/tickets` (create), `POST /tickets/:id/messages`, `POST /tickets/:id/reopen`.

## Realtime (WebSocket) channel

Live ticket conversations use a WebSocket endpoint on the **same** API server and
origin: `wss://<api-origin>/api/realtime` (see `docs/realtime-conversations.md`).

- It is attached to the existing `http.Server` via the HTTP `upgrade` event
  (`server/realtime.ts`), so it needs **no separate service, port, or process** —
  `npm start` serves both REST and WebSocket.
- **Railway** proxies WebSockets to the app with no extra configuration. Because
  state (and the in-process subscription registry) lives in one instance, keep
  **`numReplicas: 1`** — the same single-instance requirement the in-memory store
  already imposes.
- In local dev the Vite proxy forwards the upgrade (`server.proxy['/api'].ws:
  true` in `vite.config.ts`), so the browser talks same-origin.
- No new environment variables. The frontend derives the `ws(s)://` URL from the
  same `VITE_API_BASE_URL` used for REST (or same-origin in dev).

## Vercel (frontend) settings

- **Framework preset:** Vite
- **Build command:** `npm run build`
- **Output directory:** `dist`
- **Install command:** `npm install`
- **Environment variables:** `VITE_API_BASE_URL` = the API origin (Production, and Preview if used)
- Redeploy after changing `VITE_API_BASE_URL` — Vite bakes it into the bundle at build time, so a rebuild is required for changes to take effect.

## Node API host (Railway / Render) settings

- **Build command:** `npm install`
- **Start command:** `npm start` (runs `tsx server/index.ts`)
- **Health check path:** `/health` (also available at `/api/health`) — returns `{ "ok": true }`
- **Instances:** 1 (in-memory state; see note above)
- No database or additional services required.

`tsx` is a runtime dependency so `npm start` works even when the host installs
production dependencies only.

## Required deployment order

1. **Deploy the API first** and obtain its public origin (e.g. `https://heyq-api-production.up.railway.app`). Confirm `GET /health` returns `{ "ok": true }`.
2. **Set `VITE_API_BASE_URL`** on Vercel to that origin, then **deploy the frontend** (or redeploy so the value is baked in).
3. *(Optional)* If the frontend uses a domain other than `https://heyq.vercel.app`, set `HEYQ_FRONTEND_ORIGIN` on the API host to that origin and redeploy the API.

Doing the frontend first would bake in a placeholder/empty API origin and every
`/api/*` call would 404 — the failure this setup exists to prevent.
