/**
 * The AI grading boundary (server/aiReviewProvider.ts).
 *
 * Two properties matter more than the fake's answers: the provider returns a
 * RESULT UNION rather than throwing (so a model being down is control flow, not
 * an exception), and the Phase 1 transport makes NO network request.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  errorAiProvider,
  fakeAiProvider,
  getAiReviewProvider,
  rawAiProvider,
  scriptedAiProvider,
  unavailableAiProvider,
  __resetAiReviewProviderForTest,
  __setAiReviewProviderForTest,
  type AiReviewRequest,
} from './aiReviewProvider.ts';
import { buildReviewPrompt, parseAiReview } from './aiReviewPrompt.ts';
import { QUALITY_RUBRIC, allCriteria } from '../src/app/data/reviewRubric.ts';
import { getTicketDetail } from './tickets.ts';

async function request(ticketId = 'tkt-seed-5'): Promise<AiReviewRequest> {
  const evidence = (await getTicketDetail('default', ticketId))!;
  return {
    prompt: buildReviewPrompt(evidence, { rubric: QUALITY_RUBRIC, promptVersion: 'v1', agentName: 'Alex Cruz' }),
    model: 'heyq-fake-reviewer',
  };
}

afterEach(() => {
  __resetAiReviewProviderForTest();
  vi.restoreAllMocks();
});

describe('the fake provider', () => {
  it('returns a parseable answer for every rubric criterion', async () => {
    const result = await fakeAiProvider.grade(await request());
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    const parsed = parseAiReview(result.raw, QUALITY_RUBRIC);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Object.keys(parsed.findings)).toHaveLength(allCriteria(QUALITY_RUBRIC).length);
  });

  it('quotes real transcript lines as evidence, and reports a confidence', async () => {
    const evidence = (await getTicketDetail('default', 'tkt-seed-5'))!;
    const bodies = evidence.messages.map((m) => m.body);

    const result = await fakeAiProvider.grade(await request('tkt-seed-5'));
    if (result.status !== 'ok') throw new Error('expected ok');
    const parsed = parseAiReview(result.raw, QUALITY_RUBRIC);
    if (!parsed.ok) throw new Error('expected a valid parse');

    for (const finding of Object.values(parsed.findings)) {
      // Every excerpt traces back to something actually said in this ticket —
      // fabricated evidence would defeat the point of showing it.
      expect(bodies.some((b) => finding.evidence.includes(b.slice(0, 40)))).toBe(true);
      expect(finding.confidence).toBeGreaterThan(0);
      expect(finding.confidence).toBeLessThan(1); // a stand-in never claims certainty
    }
  });

  it('is deterministic — the same ticket always grades identically', async () => {
    const req = await request();
    const [a, b] = await Promise.all([fakeAiProvider.grade(req), fakeAiProvider.grade(req)]);
    expect(a).toEqual(b);
  });

  it('never fails a zero-tolerance criterion', async () => {
    // A simulated compliance accusation against a named agent would be
    // indefensible in a demo; tests that need that path script it explicitly.
    for (const ticketId of ['tkt-seed-5', 'tkt-seed-8', 'tkt-seed-10', 'tkt-bp-3']) {
      const result = await fakeAiProvider.grade(await request(ticketId));
      if (result.status !== 'ok') throw new Error('expected ok');
      const parsed = parseAiReview(result.raw, QUALITY_RUBRIC);
      if (!parsed.ok) throw new Error('expected a valid parse');
      for (const c of allCriteria(QUALITY_RUBRIC).filter((c) => c.zeroTolerance)) {
        expect(parsed.findings[c.id].value).toBe('yes');
      }
    }
  });

  it('makes no network request', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    await fakeAiProvider.grade(await request());
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('failure modes', () => {
  it('reports unavailable without throwing', async () => {
    await expect(unavailableAiProvider.grade(await request())).resolves.toEqual({ status: 'unavailable' });
  });

  it('reports a provider error without throwing', async () => {
    const result = await errorAiProvider('rate_limited', 'Too many requests.').grade(await request());
    expect(result).toEqual({ status: 'error', code: 'rate_limited', message: 'Too many requests.' });
  });

  it('can return malformed output, which the parser then refuses', async () => {
    const result = await rawAiProvider('I think the agent did fine!').grade(await request());
    expect(result.status).toBe('ok'); // the TRANSPORT succeeded…
    if (result.status !== 'ok') return;
    expect(parseAiReview(result.raw, QUALITY_RUBRIC).ok).toBe(false); // …the CONTENT did not
  });

  it('never throws to the caller across every provided mode', async () => {
    const req = await request();
    const providers = [
      fakeAiProvider,
      scriptedAiProvider({ greeting: 'yes' }),
      rawAiProvider('nonsense'),
      unavailableAiProvider,
      errorAiProvider(),
    ];
    for (const provider of providers) {
      await expect(provider.grade(req)).resolves.toHaveProperty('status');
    }
  });
});

describe('provider selection', () => {
  it('defaults to the fake and can be swapped for a test', async () => {
    expect(getAiReviewProvider().id).toBe('fake');
    __setAiReviewProviderForTest(unavailableAiProvider);
    expect(getAiReviewProvider().id).toBe('fake-unavailable');
    __resetAiReviewProviderForTest();
    expect(getAiReviewProvider().id).toBe('fake');
  });

  it('answers exactly as scripted, so a test can pin a score', async () => {
    const result = await scriptedAiProvider({ greeting: 'no', empathy: 'yes' }).grade(await request());
    if (result.status !== 'ok') throw new Error('expected ok');
    const findings = JSON.parse(result.raw).findings;
    expect(findings.greeting.value).toBe('no');
    expect(findings.empathy.value).toBe('yes');
    expect(findings.clarity).toBeUndefined(); // unscripted criteria are omitted
  });
});
