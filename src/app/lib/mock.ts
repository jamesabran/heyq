// Small helpers for the mock service layer.

// Skip artificial latency under test so the suite stays fast/deterministic; in
// the browser a short delay makes loading states visible.
const IS_TEST = typeof process !== 'undefined' && process.env?.NODE_ENV === 'test';
const DEFAULT_LATENCY_MS = 160;

/** Simulate async I/O so services behave like a future real API. */
export function simulateLatency(ms: number = DEFAULT_LATENCY_MS): Promise<void> {
  if (IS_TEST || ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Return a deep-ish clone so callers can't mutate module-state seed data. */
export function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Generate an opaque id/token with a readable prefix. */
export function makeId(prefix: string): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${rand}`;
}

/** Current ISO timestamp (single call site so it's easy to stub later). */
export function nowIso(): string {
  return new Date().toISOString();
}
