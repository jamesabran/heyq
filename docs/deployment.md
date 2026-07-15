# HeyQ deployment

HeyQ ships as **two independently deployed pieces** on **different domains**:

| Piece | What | Host | Example URL |
|---|---|---|---|
| Frontend | Vite/React static build | Vercel | `https://heyq.vercel.app` |
| API | Standalone Node mock API (`server/`) | Railway / Render (any Node host) | `https://heyq-api.up.railway.app` |

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
| `VITE_API_BASE_URL` | Yes (prod) | API origin, e.g. `https://heyq-api.up.railway.app` | **No** trailing slash, **no** `/api` suffix. Requests resolve to `${VITE_API_BASE_URL}/api/...`. Leave unset locally to use the dev proxy. |

### Backend (Node host — runtime)

| Variable | Required | Value | Notes |
|---|---|---|---|
| `PORT` | Auto | Injected by the host | Server listens on it; binds `0.0.0.0`. |
| `HEYQ_API_PORT` | No | e.g. `4310` | Local fallback only, used when `PORT` is unset. |
| `HOST` | No | default `0.0.0.0` | Override the bind address if needed. |
| `HEYQ_FRONTEND_ORIGIN` | No | e.g. `https://heyq-preview.vercel.app` | Extra allowed CORS origin. `http://localhost:18020` and `https://heyq.vercel.app` are always allowed. |

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

1. **Deploy the API first** and obtain its public origin (e.g. `https://heyq-api.up.railway.app`). Confirm `GET /health` returns `{ "ok": true }`.
2. **Set `VITE_API_BASE_URL`** on Vercel to that origin, then **deploy the frontend** (or redeploy so the value is baked in).
3. *(Optional)* If the frontend uses a domain other than `https://heyq.vercel.app`, set `HEYQ_FRONTEND_ORIGIN` on the API host to that origin and redeploy the API.

Doing the frontend first would bake in a placeholder/empty API origin and every
`/api/*` call would 404 — the failure this setup exists to prevent.
