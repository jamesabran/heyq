/**
 * apiClient — the one place every service talks to the HeyQ mock API server
 * (server/http.ts) over HTTP. HeyQ is the sole owner of ticket/notification/
 * order-provider state now (M23/M24); this replaces the module-array access
 * every service used to do directly.
 *
 * In local development the browser talks to same-origin `/api/...` (the vite
 * dev proxy routes that to the Node server). In production the frontend and the
 * standalone API live on different domains, so `VITE_API_BASE_URL` (baked in at
 * build time) points requests at the API origin — `${VITE_API_BASE_URL}/api/...`.
 * Leave it unset locally to keep the same-origin proxy behavior.
 *
 * Under vitest (`IS_TEST`, same convention as `IS_TEST` in `mock.ts`), requests
 * go to the server `src/test/setup.ts` starts fresh inside each test file's own
 * module registry — that's also what gives each test file an isolated in-memory
 * store, so there is no store-id header to manage here.
 */
const IS_TEST = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

function baseUrl(): string {
  if (IS_TEST) {
    const port = typeof process !== 'undefined' ? process.env?.HEYQ_TEST_API_PORT : undefined;
    if (!port) {
      throw new Error('HEYQ_TEST_API_PORT is not set — is src/test/setup.ts starting the test API server?');
    }
    return `http://localhost:${port}`;
  }
  // Browser: default to same-origin (vite dev proxy handles /api locally); in
  // production VITE_API_BASE_URL selects the standalone API origin. Trailing
  // slashes are trimmed so we never build a `//api` path.
  const configured = import.meta.env?.VITE_API_BASE_URL;
  return configured ? configured.replace(/\/+$/, '') : '';
}

/**
 * The WebSocket URL for the realtime channel (server/realtime.ts), derived from
 * the same origin resolution the REST client uses:
 *   • test  → ws://localhost:<HEYQ_TEST_API_PORT>/api/realtime
 *   • prod  → wss://<VITE_API_BASE_URL host>/api/realtime  (http→ws, https→wss)
 *   • dev   → same-origin ws(s), proxied to the Node server by Vite (ws:true)
 */
export function realtimeUrl(): string {
  const base = baseUrl();
  if (base) return `${base.replace(/^http/, 'ws')}/api/realtime`;
  if (typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${proto}//${window.location.host}/api/realtime`;
  }
  return '';
}

export function buildQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : '';
}

/** Thrown on any non-2xx response; carries the HTTP status so callers can
 * distinguish "not found" (404) from a real failure without string-matching. */
export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');

  const res = await fetch(`${baseUrl()}/api${path}`, { ...init, headers });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : undefined;

  if (!res.ok) {
    const message = data && typeof data === 'object' && 'error' in data ? String((data as { error: unknown }).error) : res.statusText;
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export const apiGet = <T>(path: string): Promise<T> => apiFetch<T>(path, { method: 'GET' });

export const apiPost = <T>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const apiPut = <T>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) });

export const apiPatch = <T>(path: string, body?: unknown): Promise<T> =>
  apiFetch<T>(path, { method: 'PATCH', body: body === undefined ? undefined : JSON.stringify(body) });
