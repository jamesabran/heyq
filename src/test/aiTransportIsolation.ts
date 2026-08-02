/**
 * TEST-ONLY isolation of the AI review transport. Loaded as the FIRST entry in
 * `setupFiles` (vitest.config.ts), ahead of ./setup.ts, because that file starts
 * the API server and so transitively imports server/seed.ts — and
 * `defaultReviewConfig()` reads the environment at IMPORT time. Neutralizing the
 * environment any later would be too late to matter.
 *
 * Why this exists: a developer with real Hugging Face credentials exported in
 * their shell got a different test run than CI. `HEYQ_AI_PROVIDER=huggingface`
 * plus a live `HEYQ_HF_TOKEN` silently promoted every test that runs on the
 * DEFAULT provider to the real transport — the suite then spent real inference,
 * took ~30s per call, and passed or failed depending on whether a model was up.
 * Tests must not be able to reach a paid third party by accident.
 *
 * Nothing here weakens the transport's own tests: server/aiReviewHuggingFace.test.ts
 * and the Hugging Face cases in server/aiReview.test.ts set their own fake token
 * and stub `fetch` per test, which is unaffected by either guard below.
 */

// ── 1. Selection ─────────────────────────────────────────────────────────────
// `providerFromEnv()` and `defaultReviewConfig()` both read these two, so
// clearing them pins BOTH the fake provider and the fake model id — a review
// produced by the fake must never be stamped with a real model.
delete process.env.HEYQ_AI_PROVIDER;
delete process.env.HEYQ_HF_TOKEN;

// ── 2. The wire ──────────────────────────────────────────────────────────────
// Selection is not the only route to the transport: a test can name
// `huggingFaceAiProvider` directly, and the transport tests deliberately do.
// Those stub `fetch`, but the guarantee must not rest on every future test
// remembering to — so the router host is blocked outright.
const HF_ROUTER_HOST = 'router.huggingface.co';

const realFetch = globalThis.fetch;

function targetUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
  if (targetUrl(input).includes(HF_ROUTER_HOST)) {
    const message =
      `Blocked a live Hugging Face request from the test suite (${HF_ROUTER_HOST}). ` +
      'Stub `fetch` in transport tests, or let the test use the fake provider.';
    // Rejected rather than thrown, because that is how a real `fetch` fails and
    // the caller under test should behave identically either way. Logged too:
    // the provider turns every fetch rejection into a `network_error` result,
    // which would otherwise bury this.
    console.error(message);
    return Promise.reject(new Error(message));
  }
  return realFetch(input, init);
}) as typeof fetch;
