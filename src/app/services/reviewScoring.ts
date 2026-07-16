// Pure scoring + validation for quality reviews. No I/O, no JSX — imported by the
// browser (live score while drafting) AND by the mock server (frozen score at
// submission), so the number a lead sees while grading is byte-for-byte the number
// that gets stored.
//
// The four scoring rules the product mandates all live here:
//   1. "Yes" always means the standard was met — so earned points only accrue on
//      Yes, and the rubric is authored that way.
//   2. N/A is excluded from the possible score — an N/A line contributes to
//      neither `earned` nor `possible`.
//   3. Zero-tolerance findings are surfaced separately — a No on a zero-tolerance
//      criterion is collected into `zeroToleranceFailures` regardless of the
//      average, so a strong percentage can never bury a compliance breach.
//   4. The rubric version is frozen onto submitted reviews — see submitReview in
//      server/reviews.ts; this module always scores against the rubric it is given.
import { QUALITY_RUBRIC, allCriteria } from '../data/reviewRubric';
import type {
  CriterionResponses,
  ReviewScore,
  Rubric,
} from '../models/review';

/**
 * Compute a review's score from its responses.
 *
 * - `earned`   = sum of weights answered Yes.
 * - `possible` = sum of weights answered Yes OR No (N/A and unanswered excluded).
 * - `percent`  = earned / possible × 100, rounded; null when nothing is scorable.
 * - `zeroToleranceFailures` = ids of zero-tolerance criteria answered No.
 * - `unansweredRequired` = required criteria with no answer yet (blocks submit).
 */
export function computeReviewScore(
  responses: CriterionResponses,
  rubric: Rubric = QUALITY_RUBRIC,
): ReviewScore {
  let earned = 0;
  let possible = 0;
  const zeroToleranceFailures: string[] = [];
  let unansweredRequired = 0;

  for (const criterion of allCriteria(rubric)) {
    const answer = responses[criterion.id];

    if (criterion.required && !answer) unansweredRequired += 1;

    // N/A and unanswered are excluded from the possible score entirely (rule 2).
    if (answer === 'yes') {
      earned += criterion.weight;
      possible += criterion.weight;
    } else if (answer === 'no') {
      possible += criterion.weight;
      if (criterion.zeroTolerance) zeroToleranceFailures.push(criterion.id);
    }
  }

  const percent = possible > 0 ? Math.round((earned / possible) * 100) : null;
  return { earned, possible, percent, zeroToleranceFailures, unansweredRequired };
}

/** Ids of required criteria that have not been answered yet. */
export function missingRequired(
  responses: CriterionResponses,
  rubric: Rubric = QUALITY_RUBRIC,
): string[] {
  return allCriteria(rubric)
    .filter((c) => c.required && !responses[c.id])
    .map((c) => c.id);
}

/** A review may be submitted only once every required criterion is answered. */
export function canSubmitReview(
  responses: CriterionResponses,
  rubric: Rubric = QUALITY_RUBRIC,
): boolean {
  return missingRequired(responses, rubric).length === 0;
}
