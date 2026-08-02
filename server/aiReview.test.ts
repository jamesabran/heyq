/**
 * AI review orchestration (server/aiReview.ts).
 *
 * The rules proven here are the ones a supervisor's trust rests on: the AI is
 * scored by the SAME function a supervisor is, its conclusion is frozen against
 * the threshold in force at the time, every failure mode falls back to requiring
 * a human, and none of it touches the manual review flow or the ticket.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aiReviewsEnabled, decideSupervisorRequired, runAiReview } from './aiReview.ts';
import {
  errorAiProvider,
  rawAiProvider,
  scriptedAiProvider,
  throwingAiProvider,
  unavailableAiProvider,
  __resetAiReviewProviderForTest,
  __setAiReviewProviderForTest,
} from './aiReviewProvider.ts';
import { huggingFaceAiProvider } from './aiReviewHuggingFace.ts';
import { latestAiReviewForTicket, listReviewable, saveDraft, supervisorReviewForTicket } from './reviews.ts';
import { getStore } from './store.ts';
import { DEFAULT_REVIEW_CONFIG, FAKE_AI_MODEL, PRODUCTION_AI_MODEL, defaultReviewConfig } from './seed.ts';
import { QUALITY_RUBRIC, allCriteria } from '../src/app/data/reviewRubric.ts';
import { computeReviewScore } from '../src/app/services/reviewScoring.ts';
import type { CriterionValue, ReviewScore } from '../src/app/models/review.ts';

const S = 'default';

/** Every criterion 'yes', then the given overrides — a complete answer set. */
function answers(overrides: Record<string, CriterionValue> = {}): Record<string, CriterionValue> {
  const all = Object.fromEntries(allCriteria(QUALITY_RUBRIC).map((c) => [c.id, 'yes' as CriterionValue]));
  return { ...all, ...overrides };
}

/** Scores 81% — the anchor for the threshold-boundary tests. */
const EIGHTY_ONE = answers({ greeting: 'no', used_evidence: 'no', took_ownership: 'no' });

const setThreshold = (percent: number) => {
  getStore(S).reviewConfig.thresholdPercent = percent;
};

// AI reviews are switched OFF by default (HEYQ_AI_REVIEW_ENABLED), so a test
// that runs one opts in explicitly — exactly as a deployment has to. The
// off-switch itself is covered in `the deployment off switch` below.
beforeEach(() => {
  process.env.HEYQ_AI_REVIEW_ENABLED = 'true';
});

afterEach(() => {
  __resetAiReviewProviderForTest();
  getStore(S).reviewConfig = { ...DEFAULT_REVIEW_CONFIG };
  getStore(S).aiHealth = { consecutiveFailures: 0 };
  vi.unstubAllGlobals();
  delete process.env.HEYQ_HF_TOKEN;
  delete process.env.HEYQ_AI_REVIEW_ENABLED;
});

describe('a successful run', () => {
  it('completes as succeeded and records both timestamps', async () => {
    const review = await runAiReview(S, 'tkt-seed-5');

    expect(review.reviewType).toBe('ai');
    expect(review.ai?.status).toBe('succeeded');
    expect(review.ai?.requestedAt).toEqual(expect.any(String));
    expect(review.ai?.completedAt).toEqual(expect.any(String));
    expect(review.status).toBe('submitted');
    // The agent under review is the ticket's handler, never a caller input.
    expect(review.agentId).toBe('l1_agent');
  });

  it('scores with the existing scoring function, not a second implementation', async () => {
    __setAiReviewProviderForTest(scriptedAiProvider(EIGHTY_ONE));
    const review = await runAiReview(S, 'tkt-seed-5');

    expect(review.score).toEqual(computeReviewScore(review.responses));
    expect(review.score?.percent).toBe(81);
  });

  it('freezes the rubric, prompt, model and threshold onto the record', async () => {
    setThreshold(75);
    const review = await runAiReview(S, 'tkt-seed-5');

    expect(review.rubricVersion).toBe(QUALITY_RUBRIC.version);
    expect(review.ai?.promptVersion).toBe('v1');
    expect(review.ai?.model).toBe(FAKE_AI_MODEL);
    expect(review.ai?.provider).toBe('fake');
    expect(review.thresholdPercent).toBe(75);

    // Changing the threshold afterwards must NOT rewrite a completed review.
    setThreshold(99);
    const stored = latestAiReviewForTicket(getStore(S), 'tkt-seed-5')!;
    expect(stored.thresholdPercent).toBe(75);
    expect(stored.supervisorReviewRequired).toBe(review.supervisorReviewRequired);
  });

  it('persists a rationale, evidence and confidence for every criterion', async () => {
    const review = await runAiReview(S, 'tkt-seed-5');
    const findings = review.ai!.findings!;
    expect(Object.keys(findings)).toHaveLength(allCriteria(QUALITY_RUBRIC).length);
    for (const finding of Object.values(findings)) {
      expect(finding.rationale).not.toBe('');
      expect(finding.evidence).not.toBe('');
      expect(finding.confidence).toEqual(expect.any(Number));
    }
  });

  it('persists the findings to the store, not just the returned copy', async () => {
    await runAiReview(S, 'tkt-seed-5');
    const stored = latestAiReviewForTicket(getStore(S), 'tkt-seed-5')!;
    expect(stored.ai?.findings?.greeting.evidence).toEqual(expect.any(String));
    expect(stored.responses.greeting).toBeDefined();
    expect(stored.score?.percent).toEqual(expect.any(Number));
  });

  it('refuses output with no evidence, however well-formed the rest is', async () => {
    // Evidence is not decoration: an answer a supervisor cannot trace back to the
    // conversation is refused outright rather than stored unverifiable.
    const noEvidence = Object.fromEntries(
      allCriteria(QUALITY_RUBRIC).map((c) => [c.id, { value: 'yes', rationale: 'Fine.' }]),
    );
    __setAiReviewProviderForTest(rawAiProvider(JSON.stringify({ findings: noEvidence })));
    const review = await runAiReview(S, 'tkt-seed-8');
    expect(review.ai?.status).toBe('failed');
    expect(review.ai?.error?.code).toBe('missing_evidence');
    expect(review.supervisorReviewRequired).toBe(true);
  });
});

describe('supervisor-review-required', () => {
  it('is NOT required when the score is exactly the threshold', async () => {
    setThreshold(81);
    __setAiReviewProviderForTest(scriptedAiProvider(EIGHTY_ONE));
    const review = await runAiReview(S, 'tkt-seed-8');

    expect(review.score?.percent).toBe(81);
    expect(review.supervisorReviewRequired).toBe(false);
    expect(review.supervisorReviewReason).toBeUndefined();
  });

  it('is required when the score is below the threshold', async () => {
    setThreshold(82);
    __setAiReviewProviderForTest(scriptedAiProvider(EIGHTY_ONE));
    const review = await runAiReview(S, 'tkt-seed-8');

    expect(review.score?.percent).toBe(81);
    expect(review.supervisorReviewRequired).toBe(true);
    expect(review.supervisorReviewReason).toBe('low_score');
  });

  it('is required on a zero-tolerance finding however high the percentage', async () => {
    setThreshold(80);
    __setAiReviewProviderForTest(scriptedAiProvider(answers({ respectful_tone: 'no' })));
    const review = await runAiReview(S, 'tkt-seed-10');

    expect(review.score?.percent).toBe(92); // comfortably above the threshold
    expect(review.score?.zeroToleranceFailures).toContain('respectful_tone');
    expect(review.supervisorReviewRequired).toBe(true);
    expect(review.supervisorReviewReason).toBe('zero_tolerance');
  });

  it('treats an unscorable result as requiring review', () => {
    // Unreachable through the provider path — the parser refuses `na` and demands
    // every criterion, so `possible` can never be 0. Pinned directly because the
    // decision must stay correct if that ever changes.
    const unscorable: ReviewScore = {
      earned: 0, possible: 0, percent: null, zeroToleranceFailures: [], unansweredRequired: 0,
    };
    expect(decideSupervisorRequired(unscorable, 80)).toEqual({ required: true, reason: 'unscorable' });
  });

  it('ranks a zero-tolerance finding above a low score', () => {
    const both: ReviewScore = {
      earned: 10, possible: 100, percent: 10, zeroToleranceFailures: ['data_privacy'], unansweredRequired: 0,
    };
    expect(decideSupervisorRequired(both, 80).reason).toBe('zero_tolerance');
  });
});

describe('failure is contained and falls back to a human', () => {
  const expectFailed = (review: Awaited<ReturnType<typeof runAiReview>>, code: string) => {
    expect(review.ai?.status).toBe('failed');
    expect(review.ai?.error?.code).toBe(code);
    expect(review.supervisorReviewRequired).toBe(true);
    expect(review.supervisorReviewReason).toBe('ai_failed');
    // Nothing was assessed, so nothing is presented as a completed assessment.
    expect(review.status).toBe('draft');
    expect(review.score).toBeUndefined();
  };

  it('records an unavailable provider as a failed review', async () => {
    __setAiReviewProviderForTest(unavailableAiProvider);
    expectFailed(await runAiReview(S, 'tkt-seed-15'), 'unavailable');
  });

  it('records a provider error as a failed review', async () => {
    __setAiReviewProviderForTest(errorAiProvider('rate_limited', 'Too many requests.'));
    expectFailed(await runAiReview(S, 'tkt-seed-15'), 'rate_limited');
  });

  it('records malformed output as a failed review', async () => {
    __setAiReviewProviderForTest(rawAiProvider('The agent did great, honestly.'));
    expectFailed(await runAiReview(S, 'tkt-seed-16'), 'invalid_json');
  });

  it('records an unknown criterion as a failed review', async () => {
    __setAiReviewProviderForTest(
      rawAiProvider(JSON.stringify({ findings: { made_up: { value: 'yes', rationale: 'x' } } })),
    );
    expectFailed(await runAiReview(S, 'tkt-seed-16'), 'unknown_criterion');
  });

  it('contains a provider that throws instead of returning a result', async () => {
    __setAiReviewProviderForTest(throwingAiProvider);
    expectFailed(await runAiReview(S, 'tkt-seed-17'), 'provider_threw');
  });
});

describe('configuration', () => {
  it('refuses to run when an admin has AI reviews turned off', async () => {
    getStore(S).reviewConfig.enabled = false;
    await expect(runAiReview(S, 'tkt-seed-5')).rejects.toThrow(/disabled/i);
  });

  it('creates no record at all when refused', async () => {
    // tkt-bp-3 is assigned and has no AI review, so the refusal is proven to
    // happen before any record is written — not merely before the assignee check.
    expect(latestAiReviewForTicket(getStore(S), 'tkt-bp-3')).toBeUndefined();
    getStore(S).reviewConfig.enabled = false;
    await expect(runAiReview(S, 'tkt-bp-3')).rejects.toThrow(/disabled/i);
    expect(latestAiReviewForTicket(getStore(S), 'tkt-bp-3')).toBeUndefined();
  });

  it('refuses a ticket with no assigned agent', async () => {
    await expect(runAiReview(S, 'tkt-seed-3')).rejects.toThrow(/no assigned agent/i);
  });

  it('refuses an unknown ticket', async () => {
    await expect(runAiReview(S, 'nope')).rejects.toThrow(/not found/i);
  });
});

describe('isolation from the manual flow', () => {
  it('never modifies the ticket\'s supervisor review', async () => {
    const store = getStore(S);
    // tkt-seed-7 carries a seeded supervisor DRAFT.
    const before = structuredClone(supervisorReviewForTicket(store, 'tkt-seed-7')!);

    await runAiReview(S, 'tkt-seed-7');

    const after = supervisorReviewForTicket(store, 'tkt-seed-7')!;
    expect(after).toEqual(before);
    expect(after.id).toBe('qr-seed-2');
    expect(after.reviewType).toBeUndefined(); // untouched, still legacy-shaped
  });

  it('leaves the ticket available for supervisor review after AI SUCCESS', async () => {
    await runAiReview(S, 'tkt-seed-10');
    const reviewable = await listReviewable(S);
    expect(reviewable.map((t) => t.ticketId)).toContain('tkt-seed-10');

    // …and a lead can still start their own review of it.
    const draft = await saveDraft(S, { ticketId: 'tkt-seed-10', reviewerId: 'team_lead', responses: { empathy: 'no' } });
    expect(draft.reviewType).toBe('supervisor');
  });

  it('leaves the ticket available for supervisor review after AI FAILURE', async () => {
    __setAiReviewProviderForTest(unavailableAiProvider);
    await runAiReview(S, 'tkt-bp-2');
    const reviewable = await listReviewable(S);
    expect(reviewable.map((t) => t.ticketId)).toContain('tkt-bp-2');
  });

  it('does not change the ticket', async () => {
    const store = getStore(S);
    const before = structuredClone(store.tickets.find((t) => t.id === 'tkt-seed-17')!);
    await runAiReview(S, 'tkt-seed-17');
    expect(store.tickets.find((t) => t.id === 'tkt-seed-17')).toEqual(before);
  });
});

describe('re-running', () => {
  it('is deterministic and replaces the record in place', async () => {
    const first = await runAiReview(S, 'tkt-seed-5');
    const second = await runAiReview(S, 'tkt-seed-5');

    expect(second.id).toBe(first.id); // one AI review per ticket, not a pile
    expect(second.responses).toEqual(first.responses); // same ticket ⇒ same grade
    expect(second.score).toEqual(first.score);
    expect(getStore(S).qualityReviews.filter((r) => r.ticketId === 'tkt-seed-5' && r.reviewType === 'ai')).toHaveLength(1);
  });

  it('re-runs the SEEDED AI review without corrupting anything else', async () => {
    const store = getStore(S);
    const supervisorBefore = structuredClone(store.qualityReviews.filter((r) => r.reviewType !== 'ai'));

    const rerun = await runAiReview(S, 'tkt-bp-4');
    expect(rerun.id).toBe('qr-seed-3'); // the existing AI record, reused
    expect(rerun.ai?.status).toBe('succeeded');

    // Every supervisor record in the store is byte-for-byte unchanged.
    expect(store.qualityReviews.filter((r) => r.reviewType !== 'ai')).toEqual(supervisorBefore);
  });

  it('clears a previous success when a re-run fails, rather than leaving a stale score', async () => {
    const ok = await runAiReview(S, 'tkt-bp-1');
    expect(ok.score?.percent).toEqual(expect.any(Number));

    __setAiReviewProviderForTest(unavailableAiProvider);
    const failed = await runAiReview(S, 'tkt-bp-1');
    expect(failed.id).toBe(ok.id);
    expect(failed.score).toBeUndefined();
    expect(failed.responses).toEqual({});
    expect(failed.supervisorReviewRequired).toBe(true);
  });
});

describe('AI reviewer health', () => {
  it('records a success and clears any error state', async () => {
    await runAiReview(S, 'tkt-seed-5');
    const health = getStore(S).aiHealth;
    expect(health.consecutiveFailures).toBe(0);
    expect(health.lastSuccessAt).toEqual(expect.any(String));
  });

  it('counts consecutive failures and keeps the latest code', async () => {
    __setAiReviewProviderForTest(unavailableAiProvider);
    await runAiReview(S, 'tkt-seed-5');
    await runAiReview(S, 'tkt-seed-8');

    const health = getStore(S).aiHealth;
    expect(health.consecutiveFailures).toBe(2);
    expect(health.lastErrorCode).toBe('unavailable');
    expect(health.lastErrorAt).toEqual(expect.any(String));
  });

  it('counts unusable OUTPUT as a failure too', async () => {
    // A model that reliably returns garbage is as broken as one that is down.
    __setAiReviewProviderForTest(rawAiProvider('not json at all'));
    await runAiReview(S, 'tkt-seed-5');
    expect(getStore(S).aiHealth.lastErrorCode).toBe('invalid_json');
    expect(getStore(S).aiHealth.consecutiveFailures).toBe(1);
  });

  it('resets the streak on the next success, without losing the last error', async () => {
    __setAiReviewProviderForTest(errorAiProvider('rate_limited', 'Too many requests.'));
    await runAiReview(S, 'tkt-seed-5');
    expect(getStore(S).aiHealth.consecutiveFailures).toBe(1);

    __resetAiReviewProviderForTest();
    await runAiReview(S, 'tkt-seed-5');

    const health = getStore(S).aiHealth;
    expect(health.consecutiveFailures).toBe(0);
    expect(health.lastSuccessAt).toEqual(expect.any(String));
    // The streak is current-run-of-failures, not a lifetime tally, but the last
    // error is retained so a recovered blip is still visible.
    expect(health.lastErrorCode).toBe('rate_limited');
  });
});

/**
 * Orchestration driven by the REAL Hugging Face provider with `fetch` stubbed —
 * no call ever leaves the process. Proves the transport swap changes nothing
 * downstream: same parser, same scorer, same freezing, same flags.
 */
describe('with the Hugging Face provider (fetch stubbed)', () => {
  const hfResponse = (text: string, extra: Record<string, unknown> = {}) =>
    new Response(
      JSON.stringify({
        id: 'chatcmpl-1',
        choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: text } }],
        ...extra,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );

  /** A model reply that answers every criterion properly. */
  function modelReply(overrides: Record<string, CriterionValue> = {}): string {
    const findings = Object.fromEntries(
      allCriteria(QUALITY_RUBRIC).map((c) => [
        c.id,
        {
          value: overrides[c.id] ?? 'yes',
          rationale: `Assessed ${c.id}.`,
          evidence: `agent: "…${c.id}…"`,
          confidence: 0.7,
        },
      ]),
    );
    return JSON.stringify({ findings });
  }

  function stubHuggingFace(text: string, extra: Record<string, unknown> = {}) {
    process.env.HEYQ_HF_TOKEN = 'hf_test_token';
    __setAiReviewProviderForTest(huggingFaceAiProvider);
    const fetchMock = vi.fn().mockResolvedValue(hfResponse(text, extra));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('produces a scored, frozen review from a real-provider-shaped response', async () => {
    const fetchMock = stubHuggingFace(modelReply(), { system_fingerprint: 'fp_novita_1a2b' });

    const review = await runAiReview(S, 'tkt-seed-5');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(review.ai?.provider).toBe('huggingface');
    expect(review.ai?.status).toBe('succeeded');
    expect(review.ai?.modelVersion).toBe('fp_novita_1a2b');
    expect(review.ai?.latencyMs).toEqual(expect.any(Number));
    // The configured model is used as given — the transport substitutes nothing.
    expect(review.ai?.model).toBe(DEFAULT_REVIEW_CONFIG.model);
    expect(review.score).toEqual(computeReviewScore(review.responses));
    expect(review.score?.percent).toBe(100);
    expect(review.thresholdPercent).toBe(DEFAULT_REVIEW_CONFIG.thresholdPercent);
    expect(getStore(S).aiHealth.consecutiveFailures).toBe(0);
  });

  it('applies the same zero-tolerance rule to a real response', async () => {
    stubHuggingFace(modelReply({ respectful_tone: 'no' }));
    const review = await runAiReview(S, 'tkt-seed-8');
    expect(review.supervisorReviewRequired).toBe(true);
    expect(review.supervisorReviewReason).toBe('zero_tolerance');
  });

  it('records a missing token as a failed review and a health failure', async () => {
    delete process.env.HEYQ_HF_TOKEN;
    __setAiReviewProviderForTest(huggingFaceAiProvider);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const review = await runAiReview(S, 'tkt-seed-10');

    expect(fetchMock).not.toHaveBeenCalled();
    expect(review.ai?.status).toBe('failed');
    expect(review.ai?.error?.code).toBe('missing_token');
    expect(review.supervisorReviewRequired).toBe(true);
    expect(getStore(S).aiHealth.lastErrorCode).toBe('missing_token');
  });

  it('persists the upstream failure code, not a generic one', async () => {
    process.env.HEYQ_HF_TOKEN = 'hf_test_token';
    __setAiReviewProviderForTest(huggingFaceAiProvider);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 401 })));

    const review = await runAiReview(S, 'tkt-seed-10');
    expect(review.ai?.error?.code).toBe('auth_error');
    expect(getStore(S).aiHealth.lastErrorCode).toBe('auth_error');
  });

  it('leaves the ticket in the supervisor queue after an upstream failure', async () => {
    process.env.HEYQ_HF_TOKEN = 'hf_test_token';
    __setAiReviewProviderForTest(huggingFaceAiProvider);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));

    await runAiReview(S, 'tkt-seed-10');
    const reviewable = await listReviewable(S);
    expect(reviewable.map((t) => t.ticketId)).toContain('tkt-seed-10');
  });

  it('never modifies a supervisor review, whatever the model returned', async () => {
    stubHuggingFace(modelReply());
    const before = structuredClone(supervisorReviewForTicket(getStore(S), 'tkt-seed-7')!);
    await runAiReview(S, 'tkt-seed-7');
    expect(supervisorReviewForTicket(getStore(S), 'tkt-seed-7')).toEqual(before);
  });
});

/**
 * The deployment off switch. What matters is that OFF is the default and that a
 * disabled run reaches no provider at all — not merely that it returns nothing
 * useful.
 */
describe('the deployment off switch', () => {
  /** Fails the test if anything asks it to grade. */
  const forbiddenProvider = {
    id: 'must-not-be-called',
    grade: vi.fn(async () => {
      throw new Error('the provider was called while AI reviews were disabled');
    }),
  };

  it('is OFF unless the value is exactly "true"', () => {
    for (const value of [undefined, '', 'false', 'TRUE ', 'yes', '1', 'enabled']) {
      if (value === undefined) delete process.env.HEYQ_AI_REVIEW_ENABLED;
      else process.env.HEYQ_AI_REVIEW_ENABLED = value;
      // 'TRUE ' is trimmed and lowercased, so it IS accepted — everything else
      // fails closed. Spelled out so the boundary is not a matter of guesswork.
      expect(aiReviewsEnabled()).toBe(value === 'TRUE ');
    }
  });

  it('does not call ANY provider when disabled', async () => {
    delete process.env.HEYQ_AI_REVIEW_ENABLED;
    __setAiReviewProviderForTest(forbiddenProvider);

    const review = await runAiReview(S, 'tkt-seed-5');

    expect(forbiddenProvider.grade).not.toHaveBeenCalled();
    expect(review.ai?.status).toBe('failed');
  });

  it('returns the ordinary failed record with a `disabled` code, rather than throwing', async () => {
    delete process.env.HEYQ_AI_REVIEW_ENABLED;
    const review = await runAiReview(S, 'tkt-seed-5');

    expect(review.reviewType).toBe('ai');
    expect(review.ai?.error?.code).toBe('disabled');
    expect(review.ai?.error?.message).toMatch(/switched off/i);
    // Failing safe toward a human is the whole point of the controlled response.
    expect(review.supervisorReviewRequired).toBe(true);
    expect(review.supervisorReviewReason).toBe('ai_failed');
    expect(review.score).toBeUndefined();
  });

  it('does not count being switched off against the reviewer’s health', async () => {
    delete process.env.HEYQ_AI_REVIEW_ENABLED;
    await runAiReview(S, 'tkt-seed-5');

    // A model that is simply not switched on is not a model that is failing.
    const health = getStore(S).aiHealth;
    expect(health.consecutiveFailures).toBe(0);
    expect(health.lastErrorCode).toBeUndefined();
  });

  it('grades normally once enabled — the switch is the only thing in the way', async () => {
    process.env.HEYQ_AI_REVIEW_ENABLED = 'true';
    const review = await runAiReview(S, 'tkt-seed-5');

    expect(review.ai?.status).toBe('succeeded');
    expect(review.ai?.error).toBeUndefined();
    expect(review.score?.percent).toEqual(expect.any(Number));
  });

  it('leaves the supervisor’s own review untouched while disabled', async () => {
    delete process.env.HEYQ_AI_REVIEW_ENABLED;
    await saveDraft(S, { ticketId: 'tkt-seed-5', reviewerId: 'team_lead', responses: { greeting: 'yes' } });

    await runAiReview(S, 'tkt-seed-5');

    // The manual path is not the AI's to disturb, switched off or on.
    const supervisor = supervisorReviewForTicket(getStore(S), 'tkt-seed-5');
    expect(supervisor?.responses.greeting).toBe('yes');
    expect(supervisor?.reviewType).toBe('supervisor');
  });
});

describe('the default model configuration', () => {
  afterEach(() => delete process.env.HEYQ_AI_PROVIDER);

  it('uses the fake model id while the fake transport is selected', () => {
    // A review produced by the stand-in must never be stamped with a real model
    // id — a stored record would then claim something untrue.
    expect(defaultReviewConfig().model).toBe(FAKE_AI_MODEL);
  });

  it('uses the production Gemma model when Hugging Face is selected', () => {
    process.env.HEYQ_AI_PROVIDER = 'huggingface';
    expect(defaultReviewConfig().model).toBe(PRODUCTION_AI_MODEL);
    // google/gemma-4-12B-it is on the Hub but no Inference Provider deploys it,
    // so a hosted call for it cannot be routed. 31B-it is the closest served
    // instruction-tuned Gemma 4.
    expect(PRODUCTION_AI_MODEL).toBe('google/gemma-4-31B-it');
  });

  it('leaves the threshold and prompt version alone either way', () => {
    process.env.HEYQ_AI_PROVIDER = 'huggingface';
    const production = defaultReviewConfig();
    delete process.env.HEYQ_AI_PROVIDER;
    const fake = defaultReviewConfig();

    expect(production.thresholdPercent).toBe(fake.thresholdPercent);
    expect(production.promptVersion).toBe(fake.promptVersion);
    expect(production.enabled).toBe(fake.enabled);
  });
});
