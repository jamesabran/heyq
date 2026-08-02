/**
 * The one-line read of an AI review shown at the top of the review card.
 *
 * The point of these is that the sentence is DERIVED — it restates the findings
 * already on the record and nothing else. No second model call is made to write
 * it, so it can never disagree with the findings a supervisor expands below it.
 */
import { describe, expect, it } from 'vitest';
import { summarizeAiReview } from './aiReviewSummary';
import { QUALITY_RUBRIC, allCriteria } from '../data/reviewRubric';
import type { AiFinding, CriterionValue, QualityReview } from '../models/review';

/** A review record carrying nothing but the findings the summary reads. */
function reviewWith(values: Record<string, CriterionValue>): Pick<QualityReview, 'ai'> {
  const findings: Record<string, AiFinding> = Object.fromEntries(
    Object.entries(values).map(([id, value]) => [
      id,
      { value, rationale: 'Because of what was said.', evidence: 'agent: "…"' },
    ]),
  );
  return { ai: { provider: 'fake', model: 'm', promptVersion: 'v1', status: 'succeeded', requestedAt: '', findings } };
}

const everyCriterion = (value: CriterionValue) =>
  Object.fromEntries(allCriteria(QUALITY_RUBRIC).map((c) => [c.id, value])) as Record<string, CriterionValue>;

describe('summarizing an AI review', () => {
  it('counts the criteria that passed', () => {
    const summary = summarizeAiReview(reviewWith(everyCriterion('yes')))!;
    expect(summary.passed).toBe(15);
    expect(summary.scored).toBe(15);
    expect(summary.text).toBe('15 of 15 criteria passed. Nothing was flagged for attention.');
  });

  it('names what needs attention, in plain words rather than criterion ids', () => {
    const summary = summarizeAiReview(
      reviewWith({ ...everyCriterion('yes'), empathy: 'no', verified_identity: 'no' }),
    )!;

    expect(summary.passed).toBe(13);
    expect(summary.scored).toBe(15);
    expect(summary.flagged).toEqual(['empathy', 'identity verification']);
    expect(summary.text).toBe('13 of 15 criteria passed. Attention is required for empathy and identity verification.');
  });

  it('reads a single flagged criterion as a sentence, not a list', () => {
    const summary = summarizeAiReview(reviewWith({ ...everyCriterion('yes'), clarity: 'no' }))!;
    expect(summary.text).toBe('14 of 15 criteria passed. Attention is required for clarity.');
  });

  it('separates three or more with commas and a final "and"', () => {
    const summary = summarizeAiReview(
      reviewWith({ ...everyCriterion('yes'), greeting: 'no', clarity: 'no', ownership_typo: 'no' }),
    )!;
    // An id the rubric does not have still reads as itself rather than vanishing.
    expect(summary.text).toContain('greeting, clarity and ownership_typo');
  });

  it('excludes N/A from the count, exactly as the score does', () => {
    const summary = summarizeAiReview(
      reviewWith({ ...everyCriterion('yes'), set_expectations: 'na', timely_handling: 'na' }),
    )!;
    expect(summary.scored).toBe(13);
    expect(summary.text).toContain('13 of 13 criteria passed.');
  });

  it('reports flagged criteria in rubric order, not the order the model answered', () => {
    // `verified_identity` sits in the last section, `greeting` in the first.
    const summary = summarizeAiReview(
      reviewWith({ verified_identity: 'no', greeting: 'no' }),
    )!;
    expect(summary.flagged).toEqual(['greeting', 'identity verification']);
  });

  it('has nothing to say about a review with no findings', () => {
    expect(summarizeAiReview(null)).toBeNull();
    expect(summarizeAiReview(undefined)).toBeNull();
    expect(summarizeAiReview({ ai: undefined })).toBeNull();
    // A failed run records an error and no findings — there is nothing to
    // summarize, and inventing a sentence for it would be worse than silence.
    expect(
      summarizeAiReview({
        ai: {
          provider: 'fake', model: 'm', promptVersion: 'v1', status: 'failed',
          requestedAt: '', error: { code: 'unavailable', message: 'down' },
        },
      }),
    ).toBeNull();
  });
});
