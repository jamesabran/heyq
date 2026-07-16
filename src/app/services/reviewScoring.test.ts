import { describe, expect, it } from 'vitest';
import {
  canSubmitReview,
  computeReviewScore,
  missingRequired,
} from './reviewScoring';
import { QUALITY_RUBRIC } from '../data/reviewRubric';

// Rubric v1 has six required criteria and three zero-tolerance criteria; the
// tests below pin the scoring rules rather than the exact rubric numbers so a
// rubric tweak that keeps the rules intact won't break them spuriously.
const REQUIRED_COUNT = QUALITY_RUBRIC.sections
  .flatMap((s) => s.criteria)
  .filter((c) => c.required).length;

describe('computeReviewScore', () => {
  it('scores nothing when there are no answers', () => {
    const score = computeReviewScore({});
    expect(score.earned).toBe(0);
    expect(score.possible).toBe(0);
    expect(score.percent).toBeNull();
    expect(score.unansweredRequired).toBe(REQUIRED_COUNT);
  });

  it('earns a criterion\'s weight only on Yes', () => {
    // greeting is worth 5.
    const score = computeReviewScore({ greeting: 'yes' });
    expect(score.earned).toBe(5);
    expect(score.possible).toBe(5);
    expect(score.percent).toBe(100);
  });

  it('counts a No toward the possible score but earns nothing', () => {
    // greeting yes (5), clarity no (5) → 5 / 10 = 50%.
    const score = computeReviewScore({ greeting: 'yes', clarity: 'no' });
    expect(score.earned).toBe(5);
    expect(score.possible).toBe(10);
    expect(score.percent).toBe(50);
  });

  it('excludes N/A from the possible score entirely (scoring rule 2)', () => {
    // greeting yes (5), clarity na → clarity contributes to neither side.
    const score = computeReviewScore({ greeting: 'yes', clarity: 'na' });
    expect(score.earned).toBe(5);
    expect(score.possible).toBe(5);
    expect(score.percent).toBe(100);
  });

  it('flags a zero-tolerance criterion answered No (scoring rule 3)', () => {
    const score = computeReviewScore({ respectful_tone: 'no' });
    expect(score.zeroToleranceFailures).toContain('respectful_tone');
    // A zero-tolerance Yes never flags.
    expect(computeReviewScore({ respectful_tone: 'yes' }).zeroToleranceFailures).toHaveLength(0);
  });

  it('treats N/A as an answer for required-completeness', () => {
    // empathy is required; N/A is a deliberate answer, so it no longer counts as missing.
    const score = computeReviewScore({ empathy: 'na' });
    expect(score.unansweredRequired).toBe(REQUIRED_COUNT - 1);
  });

  it('rounds the percentage', () => {
    // greeting yes (5) + empathy no (10) → 5 / 15 = 33.33% → 33.
    expect(computeReviewScore({ greeting: 'yes', empathy: 'no' }).percent).toBe(33);
  });
});

describe('submission gating', () => {
  it('blocks submission until every required criterion is answered', () => {
    expect(canSubmitReview({})).toBe(false);
    expect(missingRequired({})).toHaveLength(REQUIRED_COUNT);
  });

  it('allows submission once all required criteria have an answer', () => {
    const answers = Object.fromEntries(
      QUALITY_RUBRIC.sections
        .flatMap((s) => s.criteria)
        .filter((c) => c.required)
        .map((c) => [c.id, 'yes' as const]),
    );
    expect(canSubmitReview(answers)).toBe(true);
    expect(missingRequired(answers)).toHaveLength(0);
  });
});
