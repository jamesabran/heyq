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

/** The model these tests ask for — the one HeyQ actually configures. */
const REQUESTED_MODEL = 'google/gemma-4-31B-it';

async function request(): Promise<AiReviewRequest> {
  const evidence = (await getTicketDetail('default', 'tkt-seed-5'))!;
  return {
    prompt: buildReviewPrompt(evidence, { rubric: QUALITY_RUBRIC, promptVersion: 'v1', agentName: 'Alex Cruz' }),
    model: REQUESTED_MODEL,
  };
}

/** A chat-completions response the provider should accept. */
const okResponse = (text: string, extra: Record<string, unknown> = {}) =>
  new Response(
    JSON.stringify({
      id: 'chatcmpl-1',
      choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: text } }],
      ...extra,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );

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

  it('calls the router chat-completions endpoint with the model in the BODY', async () => {
    fetchMock.mockResolvedValue(okResponse('{}'));
    await huggingFaceAiProvider.grade(await request());

    const [url, init] = fetchMock.mock.calls[0];
    // The old api-inference host is no longer supported; the model now travels
    // in the payload rather than the path.
    expect(String(url)).toBe('https://router.huggingface.co/v1/chat/completions');
    expect(String(url)).not.toContain('api-inference');

    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(REQUESTED_MODEL);
    expect(body.messages).toEqual([{ role: 'user', content: expect.any(String) }]);
    expect(body.stream).toBe(false);
  });

  it('sends the token only as a bearer header', async () => {
    fetchMock.mockResolvedValue(okResponse('{}'));
    await huggingFaceAiProvider.grade(await request());

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).not.toContain(TOKEN); // never in the URL
    expect((init.headers as Record<string, string>).Authorization).toBe(`Bearer ${TOKEN}`);
    expect(init.body).not.toContain(TOKEN); // never in the body
    expect(init.signal).toBeDefined(); // bounded by an abort signal
  });

  it('captures system_fingerprint as the model version when present', async () => {
    fetchMock.mockResolvedValue(okResponse('{}', { system_fingerprint: 'fp_novita_1a2b' }));
    const result = await huggingFaceAiProvider.grade(await request());
    expect(result.status === 'ok' && result.modelVersion).toBe('fp_novita_1a2b');
  });

  it('captures the RESOLVED model when routing served a different one', async () => {
    fetchMock.mockResolvedValue(okResponse('{}', { model: 'google/gemma-4-26B-A4B-it' }));
    const result = await huggingFaceAiProvider.grade(await request());
    expect(result.status === 'ok' && result.modelVersion).toBe('google/gemma-4-26B-A4B-it');
  });

  it('leaves the model version UNSET when the body only echoes what we asked for', async () => {
    // An echo is not a version. Inventing one would put a false claim on a
    // frozen review, which is worse than recording nothing.
    fetchMock.mockResolvedValue(okResponse('{}', { model: REQUESTED_MODEL }));
    const result = await huggingFaceAiProvider.grade(await request());
    expect(result.status === 'ok' && result.modelVersion).toBeUndefined();
  });

  it('leaves the model version UNSET when the body reports neither', async () => {
    fetchMock.mockResolvedValue(okResponse('{}'));
    const result = await huggingFaceAiProvider.grade(await request());
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

  it('refuses a JSON body with no choices', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ id: 'x', choices: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await huggingFaceAiProvider.grade(await request());
    expect(result.status === 'error' && result.code).toBe('invalid_response');
  });

  it('refuses a choice with no message content', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ choices: [{ index: 0, finish_reason: 'stop' }] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const result = await huggingFaceAiProvider.grade(await request());
    expect(result.status === 'error' && result.code).toBe('invalid_response');
  });

  it('refuses the LEGACY text-generation shape, rather than silently accepting it', async () => {
    // `[{generated_text}]` is what the retired api-inference host returned. If it
    // ever comes back, that means we are talking to the wrong endpoint — which
    // should surface, not be quietly tolerated.
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify([{ generated_text: '{"findings":{}}' }]), {
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

  it('extracts the assistant message from a chat-completions body', () => {
    expect(extractGeneratedText({ choices: [{ message: { content: 'a' } }] })).toBe('a');
    expect(extractGeneratedText({ choices: [{ message: { content: '  ' } }] })).toBeNull();
    expect(extractGeneratedText({ choices: [{ message: {} }] })).toBeNull();
    expect(extractGeneratedText({ choices: [] })).toBeNull();
    expect(extractGeneratedText([{ generated_text: 'legacy' }])).toBeNull();
    expect(extractGeneratedText('nope')).toBeNull();
    expect(extractGeneratedText(null)).toBeNull();
  });

  it('reads the model version from the body, never from an echo', () => {
    expect(readModelVersion({ system_fingerprint: 'fp1' }, 'm')).toBe('fp1');
    expect(readModelVersion({ model: 'other/model' }, 'm')).toBe('other/model');
    expect(readModelVersion({ model: 'm' }, 'm')).toBeUndefined(); // an echo is not a version
    expect(readModelVersion({}, 'm')).toBeUndefined();
    expect(readModelVersion(null, 'm')).toBeUndefined();
    // A fingerprint wins over the model id when both are present.
    expect(readModelVersion({ system_fingerprint: 'fp1', model: 'other/model' }, 'm')).toBe('fp1');
  });
});
