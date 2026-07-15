/**
 * apiClient — the one place every service talks to the HeyQ mock API server
 * (server/http.ts) over HTTP. HeyQ is the sole owner of ticket/notification/
 * order-provider state now (M23/M24); this replaces the module-array access
 * every service used to do directly.
 *
 * In the browser, requests go to same-origin `/api/...` (vite dev proxy routes
 * that to the Node server). Under vitest (`IS_TEST`, same convention as
 * `IS_TEST` in `mock.ts`), requests go to the server `src/test/setup.ts`
 * starts fresh inside each test file's own module registry — that's also what
 * gives each test file an isolated in-memory store, so there is no store-id
 * header to manage here.
 */
const IS_TEST = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';

function baseUrl(): string {
  if (!IS_TEST) return ''; // same-origin; vite proxies /api to the Node server
  const port = typeof process !== 'undefined' ? process.env?.HEYQ_TEST_API_PORT : undefined;
  if (!port) {
    throw new Error('HEYQ_TEST_API_PORT is not set — is src/test/setup.ts starting the test API server?');
  }
  return `http://localhost:${port}`;
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
