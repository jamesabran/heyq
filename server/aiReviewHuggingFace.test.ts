/**
 * The real Hugging Face transport (server/aiReviewHuggingFace.ts).
 *
 * `fetch` is stubbed in EVERY test — nothing here may reach Hugging Face, and a
 * guard asserts the token never leaves the Authorization header.
 *
 * What matters most: the retry boundary (transient once, terminal never), the
 * error-code mapping that gets frozen onto a review, and the refusal to invent a
 * model version.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HF_TIMEOUT_MS,
  extractGeneratedText,
  huggingFaceAiProvider,
  readModelVersion,
  toHuggingFaceInput,
} from './aiReviewHuggingFace.ts';
import { isTransientFailure, type AiFailureCode, type AiReviewRequest } from './aiReviewProvider.ts';
import { buildReviewPrompt } from './aiReviewPrompt.ts';
import { QUALITY_RUBRIC } from '../src/app/data/reviewRubric.ts';
import { getTicketDetail } from './tickets.ts';

const TOKEN = 'hf_test_token_value';

async function request(): Promise<AiReviewRequest> {
  const evidence = (await getTicketDetail('default', 'tkt-seed-5'))!;
  return {
    prompt: buildReviewPrompt(evidence, { rubric: QUALITY_RUBRIC, promptVersion: 'v1', agentName: 'Alex Cruz' }),
    model: 'google/gemma-2-9b-it',
  };
}

/** A response the provider should accept. */
const okResponse = (text: string, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify([{ generated_text: text }]), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...headers },
  });

const errorResponse = (status: number) =>
  new Response(JSON.stringify({ error: 'upstream detail' }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.HEYQ_HF_TOKEN = TOKEN;
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.HEYQ_HF_TOKEN;
});

describe('a successful call', () => {
  it('returns the generated text with a latency', async () => {
    const raw = JSON.stringify({ findings: {} });
    fetchMock.mockResolvedValue(okResponse(raw));

    const result = await huggingFaceAiProvider.grade(await request());

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.raw).toBe(raw);
    expect(result.latencyMs).toEqual(expect.any(Number));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('posts to the CONFIGURED model and sends the token only as a bearer header', async () => {
    fetchMock.mockResolvedValue(okResponse('{}'));
    await huggingFaceAiProvider.grade(await request());

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain('google/gemma-2-9b-it');
    expect(String(url)).not.toContain(TOKEN); // never in the URL
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.body).not.toContain(TOKEN); // never in the body
    expect(init.signal).toBeDefined(); // bounded by an abort signal
  });

  it('captures a model revision when the host reports one', async () => {
    fetchMock.mockResolvedValue(okResponse('{}', { 'x-repo-commit': 'abc123def' }));
    const result = await huggingFaceAiProvider.grade(await request());
    expect(result.status === 'ok' && result.modelVersion).toBe('abc123def');
  });

  it('leaves the model version UNSET when the host reports none', async () => {
    fetchMock.mockResolvedValue(okResponse('{}'));
    const result = await huggingFaceAiProvider.grade(await request());
    // Inventing a version would put a false claim on a frozen review.
    expect(result.status === 'ok' && result.modelVersion).toBeUndefined();
  });
});

describe('error mapping', () => {
  const codeFor = async (status: number): Promise<string | undefined> => {
    fetchMock.mockResolvedValue(errorResponse(status));
    const result = await huggingFaceAiProvider.grade(await request());
    if (result.status === 'ok') throw new Error('expected a failure');
    return result.code;
  };

  it('maps authentication and permission failures', async () => {
    expect(await codeFor(401)).toBe('auth_error');
    expect(await codeFor(403)).toBe('auth_error');
  });

  it('maps invalid-request failures', async () => {
    expect(await codeFor(400)).toBe('invalid_request');
    expect(await codeFor(404)).toBe('invalid_request');
    expect(await codeFor(422)).toBe('invalid_request');
  });

  it('maps rate limiting', async () => {
    expect(await codeFor(429)).toBe('rate_limited');
  });

  it('maps a loading/unavailable model', async () => {
    expect(await codeFor(503)).toBe('model_loading');
  });

  it('maps other upstream failures', async () => {
    expect(await codeFor(500)).toBe('upstream_error');
    expect(await codeFor(502)).toBe('upstream_error');
  });

  it('reports a missing token without calling out at all', async () => {
    delete process.env.HEYQ_HF_TOKEN;
    const result = await huggingFaceAiProvider.grade(await request());

    expect(result.status === 'error' && result.code).toBe('missing_token');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never leaks the token or the upstream body into a failure message', async () => {
    fetchMock.mockResolvedValue(errorResponse(401));
    const result = await huggingFaceAiProvider.grade(await request());
    if (result.status === 'ok') throw new Error('expected a failure');
    expect(result.message).not.toContain(TOKEN);
    expect(result.message).not.toContain('upstream detail');
  });

  it('maps a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    const result = await huggingFaceAiProvider.grade(await request());
    expect(result.status === 'unavailable' && result.code).toBe('network_error');
  });

  it('maps a timeout when the request is aborted', async () => {
    // Resolve only once the provider's own AbortController fires.
    fetchMock.mockImplementation(
      (_url: string, init: { signal: AbortSignal }) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        }),
    );
    const req = await request();
    vi.useFakeTimers();
    try {
      const promise = huggingFaceAiProvider.grade(req);
      // A timeout is transient, so BOTH attempts have to time out before the
      // provider gives up — advancing once would leave the retry hanging.
      await vi.advanceTimersByTimeAsync(HF_TIMEOUT_MS + 1);
      await vi.advanceTimersByTimeAsync(HF_TIMEOUT_MS + 1);
      const result = await promise;
      expect(result.status === 'unavailable' && result.code).toBe('timeout');
      expect(fetchMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('invalid provider responses', () => {
  it('refuses a body that is not JSON', async () => {
    fetchMock.mockResolvedValue(new Response('<html>gateway</html>', { status: 200 }));
    const result = await huggingFaceAiProvider.grade(await request());
    expect(result.status === 'error' && result.code).toBe('invalid_response');
  });

  it('refuses a JSON body with no generated text', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ something_else: 'x' }]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await huggingFaceAiProvider.grade(await request());
    expect(result.status === 'error' && result.code).toBe('invalid_response');
  });

  it('refuses an empty generated text rather than passing "" to the parser', async () => {
    fetchMock.mockResolvedValue(okResponse('   '));
    const result = await huggingFaceAiProvider.grade(await request());
    expect(result.status === 'error' && result.code).toBe('invalid_response');
  });
});

describe('the retry boundary', () => {
  const transient: AiFailureCode[] = ['rate_limited', 'model_loading', 'upstream_error'];
  const terminal: AiFailureCode[] = ['auth_error', 'invalid_request'];

  it.each([
    [429, 'rate_limited'],
    [503, 'model_loading'],
    [500, 'upstream_error'],
  ])('retries ONCE on %i (%s)', async (status) => {
    fetchMock.mockResolvedValue(errorResponse(status));
    await huggingFaceAiProvider.grade(await request());
    expect(fetchMock).toHaveBeenCalledTimes(2); // once, not more
  });

  it.each([
    [401, 'auth_error'],
    [403, 'auth_error'],
    [400, 'invalid_request'],
  ])('does NOT retry %i (%s)', async (status) => {
    fetchMock.mockResolvedValue(errorResponse(status));
    await huggingFaceAiProvider.grade(await request());
    // These fail identically forever; retrying only doubles load and latency.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries a network failure once', async () => {
    fetchMock.mockRejectedValue(new TypeError('fetch failed'));
    await huggingFaceAiProvider.grade(await request());
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry an unreadable response — the model answered, just not usably', async () => {
    fetchMock.mockResolvedValue(new Response('not json', { status: 200 }));
    await huggingFaceAiProvider.grade(await request());
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('succeeds on the retry when the first attempt was transient', async () => {
    fetchMock
      .mockResolvedValueOnce(errorResponse(503))
      .mockResolvedValueOnce(okResponse(JSON.stringify({ findings: {} })));

    const result = await huggingFaceAiProvider.grade(await request());
    expect(result.status).toBe('ok');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('classifies transient vs terminal codes consistently', () => {
    for (const code of transient) expect(isTransientFailure(code)).toBe(true);
    for (const code of terminal) expect(isTransientFailure(code)).toBe(false);
    expect(isTransientFailure('missing_token')).toBe(false);
    expect(isTransientFailure('invalid_response')).toBe(false);
  });
});

describe('never throws to the caller', () => {
  it.each([
    ['a rejecting fetch', () => fetchMock.mockRejectedValue(new Error('boom'))],
    ['a non-Error rejection', () => fetchMock.mockRejectedValue('string failure')],
    ['a body that throws on read', () =>
      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers(),
        json: () => Promise.reject(new Error('stream died')),
      })],
  ])('contains %s', async (_label, arrange) => {
    arrange();
    await expect(huggingFaceAiProvider.grade(await request())).resolves.toHaveProperty('status');
  });
});

describe('prompt serialization and helpers', () => {
  it('renders the rubric, ticket and conversation into the model input', async () => {
    const { prompt } = await request();
    const input = toHuggingFaceInput(prompt);

    expect(input).toContain(prompt.instructions);
    expect(input).toContain('HQ-2026-0005');
    expect(input).toContain('- greeting:');
    expect(input).toContain('yes, no'); // the allowed values, with na withheld
    expect(input).not.toContain('na,');
  });

  it('extracts generated text from both response shapes', () => {
    expect(extractGeneratedText([{ generated_text: 'a' }])).toBe('a');
    expect(extractGeneratedText({ generated_text: 'b' })).toBe('b');
    expect(extractGeneratedText([{}])).toBeNull();
    expect(extractGeneratedText('nope')).toBeNull();
    expect(extractGeneratedText(null)).toBeNull();
  });

  it('reads a revision header, unquoting an etag', () => {
    expect(readModelVersion(new Headers({ etag: '"deadbeef"' }))).toBe('deadbeef');
    expect(readModelVersion(new Headers({ 'x-model-revision': 'r1' }))).toBe('r1');
    expect(readModelVersion(new Headers())).toBeUndefined();
  });
});
