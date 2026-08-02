/**
 * aiReviewHuggingFace — the real model transport, behind the unchanged
 * `AiReviewProvider` interface.
 *
 * This is the ONLY file in HeyQ that makes a network call for AI review, and the
 * only one that reads `HEYQ_HF_TOKEN`. The token is environment-only: it is never
 * stored, never returned in a result, never included in an error message, and
 * never logged. Errors from here carry a stable code and a message written for a
 * supervisor to read, not a raw upstream body that could echo the request.
 *
 * Everything downstream — the strict parser, `computeReviewScore`, the frozen
 * record, the supervisor-required decision — is identical to the fake path. The
 * model named in `reviewConfig` is used as given; this module never substitutes
 * a default of its own.
 */
import {
  isTransientFailure,
  type AiFailureCode,
  type AiGradeResult,
  type AiReviewProvider,
  type AiReviewRequest,
} from './aiReviewProvider.ts';
import type { AiReviewPrompt } from './aiReviewPrompt.ts';

/** Bounded so a hung model can never hold a request open indefinitely. */
export const HF_TIMEOUT_MS = 30_000;

/**
 * The Inference Providers router — an OpenAI-compatible chat-completions
 * endpoint. The older `api-inference.huggingface.co/models/{id}` host this
 * originally targeted is no longer supported and answers with a redirect notice,
 * so the model id now travels in the BODY rather than the path.
 */
const HF_CHAT_COMPLETIONS_URL = 'https://router.huggingface.co/v1/chat/completions';

/** One retry only, and only for a condition that may simply pass on its own. */
const MAX_ATTEMPTS = 2;

interface HfFailure {
  code: AiFailureCode;
  message: string;
}

/**
 * Render the structured prompt as the single instruction string an inference
 * endpoint takes. Kept here rather than in the pure prompt module because it is
 * a TRANSPORT concern: a different host may want a different serialization of
 * the same prompt object.
 */
export function toHuggingFaceInput(prompt: AiReviewPrompt): string {
  const criteria = prompt.criteria
    .map((c) => `- ${c.id}: ${c.label}${c.hint ? ` (${c.hint})` : ''}`)
    .join('\n');
  const conversation = prompt.conversation.map((m) => `${m.author}: ${m.body}`).join('\n');

  return [
    prompt.instructions,
    `Allowed values: ${prompt.allowedValues.join(', ')}.`,
    '',
    `Ticket ${prompt.ticket.reference} — ${prompt.ticket.subject}`,
    `Concern: ${prompt.ticket.concern}. Status: ${prompt.ticket.status}. Agent: ${prompt.ticket.agentName}.`,
    '',
    'Criteria:',
    criteria,
    '',
    'Conversation:',
    conversation,
  ].join('\n');
}

/**
 * Map an HTTP status to a stable code. 503 is Hugging Face's "model is loading"
 * signal as well as a generic outage; both are worth one retry, so they share a
 * code only where the body does not tell us more (see `classifyResponse`).
 */
function codeForStatus(status: number): AiFailureCode {
  if (status === 401 || status === 403) return 'auth_error';
  if (status === 400 || status === 404 || status === 422) return 'invalid_request';
  if (status === 429) return 'rate_limited';
  if (status === 503) return 'model_loading';
  if (status >= 500) return 'upstream_error';
  return 'upstream_error';
}

/**
 * A thrown fetch rejection is a timeout (we aborted it) or a network failure.
 * The thrown message is deliberately NOT interpolated into ours: fetch errors can
 * carry request details, and nothing derived from the request should be able to
 * reach a stored review.
 */
function codeForThrown(timedOut: boolean): HfFailure {
  return timedOut
    ? { code: 'timeout', message: `The AI reviewer did not respond within ${HF_TIMEOUT_MS / 1000}s.` }
    : { code: 'network_error', message: 'Could not reach the AI reviewer.' };
}

/** Human-readable failure text per code. Never includes upstream body or headers. */
const FAILURE_MESSAGES: Record<AiFailureCode, string> = {
  missing_token: 'The AI reviewer is not configured (no access token).',
  timeout: 'The AI reviewer timed out.',
  network_error: 'Could not reach the AI reviewer.',
  rate_limited: 'The AI reviewer is rate limited.',
  model_loading: 'The AI model is still loading.',
  auth_error: 'The AI reviewer rejected our credentials.',
  invalid_request: 'The AI reviewer rejected the request.',
  upstream_error: 'The AI reviewer returned an upstream error.',
  invalid_response: 'The AI reviewer returned a response we could not read.',
};

/**
 * Pull the assistant's message out of a chat-completions body:
 * `choices[0].message.content`. Anything else is `invalid_response` — we never
 * guess at a body we do not recognise, because a guess becomes a stored review.
 */
export function extractGeneratedText(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const choices = (body as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;

  const message = (choices[0] as Record<string, unknown> | undefined)?.message;
  if (!message || typeof message !== 'object') return null;

  const content = (message as Record<string, unknown>).content;
  return typeof content === 'string' && content.trim() !== '' ? content : null;
}

/**
 * The resolved model identity, from the response body.
 *
 * The router exposes no revision or commit header, so there is nothing to read
 * from the headers at all. What it DOES return is OpenAI-compatible:
 * `system_fingerprint` (the backend configuration a response was produced with)
 * and `model` (the model actually served, which differs from what we asked for
 * when a routing policy or provider suffix resolves).
 *
 * An echo of the model we requested is not a version, so it is not recorded as
 * one — an unreported version stays undefined rather than being invented.
 */
export function readModelVersion(body: unknown, requestedModel: string): string | undefined {
  if (!body || typeof body !== 'object') return undefined;
  const { system_fingerprint: fingerprint, model } = body as Record<string, unknown>;

  if (typeof fingerprint === 'string' && fingerprint.trim() !== '') return fingerprint.trim();
  if (typeof model === 'string' && model.trim() !== '' && model.trim() !== requestedModel) return model.trim();
  return undefined;
}

/** One HTTP attempt. Returns a grade result, or a failure to be considered for retry. */
async function attempt(
  request: AiReviewRequest,
  token: string,
): Promise<{ result: AiGradeResult } | { failure: HfFailure; latencyMs: number }> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, HF_TIMEOUT_MS);
  const startedAt = Date.now();

  try {
    const response = await fetch(HF_CHAT_COMPLETIONS_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        // The only place the token appears. Not logged, not echoed, not stored.
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: request.model,
        messages: [{ role: 'user', content: toHuggingFaceInput(request.prompt) }],
        stream: false,
      }),
    });
    const latencyMs = Date.now() - startedAt;

    if (!response.ok) {
      const code = codeForStatus(response.status);
      return { failure: { code, message: FAILURE_MESSAGES[code] }, latencyMs };
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { failure: { code: 'invalid_response', message: FAILURE_MESSAGES.invalid_response }, latencyMs };
    }

    const raw = extractGeneratedText(body);
    if (raw === null) {
      return { failure: { code: 'invalid_response', message: FAILURE_MESSAGES.invalid_response }, latencyMs };
    }

    const modelVersion = readModelVersion(body, request.model);
    return { result: { status: 'ok', raw, latencyMs, ...(modelVersion ? { modelVersion } : {}) } };
  } catch {
    return { failure: codeForThrown(timedOut), latencyMs: Date.now() - startedAt };
  } finally {
    clearTimeout(timer);
  }
}

/** Turn a failure into the union shape orchestration consumes. */
function toResult(failure: HfFailure, latencyMs: number): AiGradeResult {
  // "Unavailable" is reserved for the model being unreachable or not up yet;
  // everything else is a definite error we should not present as a blip.
  const unavailable: AiFailureCode[] = ['model_loading', 'network_error', 'timeout'];
  return unavailable.includes(failure.code)
    ? { status: 'unavailable', code: failure.code, message: failure.message, latencyMs }
    : { status: 'error', code: failure.code, message: failure.message, latencyMs };
}

/**
 * The Hugging Face provider. Never throws: every outcome — including a missing
 * token, an abort, or a body we cannot read — comes back as a typed result.
 */
export const huggingFaceAiProvider: AiReviewProvider = {
  id: 'huggingface',

  async grade(request) {
    const token = process.env.HEYQ_HF_TOKEN?.trim();
    if (!token) {
      // Deliberately checked here, not at startup: a deployment may legitimately
      // run with AI reviews configured but unusable, and that should surface as a
      // failed review a supervisor can see — not a boot crash.
      return { status: 'error', code: 'missing_token', message: FAILURE_MESSAGES.missing_token };
    }

    let last: { failure: HfFailure; latencyMs: number } | undefined;

    for (let n = 0; n < MAX_ATTEMPTS; n++) {
      const outcome = await attempt(request, token);
      if ('result' in outcome) return outcome.result;

      last = outcome;
      // Retry once, and only for a condition that may pass on its own. An auth,
      // permission, or invalid-request failure will fail identically forever, so
      // retrying it only doubles the load and the latency.
      if (!isTransientFailure(outcome.failure.code)) break;
    }

    return toResult(last!.failure, last!.latencyMs);
  },
};
