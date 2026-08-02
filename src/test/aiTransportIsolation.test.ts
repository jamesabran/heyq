/**
 * Regression coverage for src/test/aiTransportIsolation.ts.
 *
 * This is the test that keeps the rest of the suite honest: it proves the run
 * cannot reach Hugging Face just because a developer has real credentials
 * exported in their shell. It is written to FAIL on a machine with
 * `HEYQ_AI_PROVIDER=huggingface` and a live `HEYQ_HF_TOKEN` set, if the
 * isolation is ever removed from `setupFiles`.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { HF_TIMEOUT_MS, huggingFaceAiProvider } from '../../server/aiReviewHuggingFace.ts';
import { getAiReviewProvider } from '../../server/aiReviewProvider.ts';
import { buildReviewPrompt } from '../../server/aiReviewPrompt.ts';
import { FAKE_AI_MODEL, PRODUCTION_AI_MODEL, defaultReviewConfig } from '../../server/seed.ts';
import { getTicketDetail } from '../../server/tickets.ts';
import { QUALITY_RUBRIC } from '../app/data/reviewRubric.ts';

describe('AI transport isolation — selection', () => {
  it('clears the two environment variables that select the real transport', () => {
    expect(process.env.HEYQ_AI_PROVIDER).toBeUndefined();
    expect(process.env.HEYQ_HF_TOKEN).toBeUndefined();
  });

  it('resolves the FAKE provider by default', () => {
    expect(getAiReviewProvider().id).toBe('fake');
  });

  it('stamps the fake model id on the default config, never the real one', () => {
    // A review produced by the fake must not claim a real model produced it.
    expect(defaultReviewConfig().model).toBe(FAKE_AI_MODEL);
    expect(defaultReviewConfig().model).not.toBe(PRODUCTION_AI_MODEL);
  });
});

describe('AI transport isolation — the wire', () => {
  afterEach(() => {
    delete process.env.HEYQ_HF_TOKEN;
  });

  it('blocks a direct fetch to the Hugging Face router', async () => {
    await expect(fetch('https://router.huggingface.co/v1/chat/completions')).rejects.toThrow(/blocked a live/i);
  });

  it('still allows every other host through', async () => {
    // The suite talks to its own API server over real HTTP; the guard must be
    // narrow enough not to break that.
    const res = await fetch(`http://localhost:${process.env.HEYQ_TEST_API_PORT}/api/health`);
    expect(res.ok).toBe(true);
  });

  it('cannot reach Hugging Face even when a test names the real provider with a token', async () => {
    // The belt-and-braces case: selection is bypassed entirely and a token is
    // present, so only the wire guard stands between this and a paid request.
    process.env.HEYQ_HF_TOKEN = 'hf_not_a_real_token';
    const evidence = (await getTicketDetail('default', 'tkt-seed-5'))!;
    const prompt = buildReviewPrompt(evidence, {
      rubric: QUALITY_RUBRIC,
      promptVersion: 'v1',
      agentName: 'Alex Cruz',
    });

    const result = await huggingFaceAiProvider.grade({ prompt, model: PRODUCTION_AI_MODEL });

    // Blocked at the socket, so the provider reports it as unreachable — and
    // critically never as a graded answer.
    expect(result.status).not.toBe('ok');
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.code).toBe('network_error');
    // It failed instantly rather than burning the full transport budget.
    expect(result.latencyMs!).toBeLessThan(HF_TIMEOUT_MS);
  });
});
