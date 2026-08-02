// A one-line, plain-language read of an AI review, derived ENTIRELY from the
// structured result already on the record. No second model call is made to write
// it: a summary that could disagree with the findings underneath it is worse than
// no summary, and paying for inference to restate data we already hold is waste.
//
// Pure, no I/O, no JSX — so it can be unit-tested on its own and rendered
// wherever an AI review is shown.
import { allCriteria, findCriterion } from '../data/reviewRubric';
import type { AiFinding, QualityReview } from '../models/review';

/** How an AI review's findings break down. `flagged` are the criteria answered No. */
export interface AiReviewSummary {
  /** Criteria answered Yes. */
  passed: number;
  /** Criteria that were scored at all — Yes or No. N/A is excluded (scoring rule 2). */
  scored: number;
  /** Short names of the criteria answered No, in rubric order. */
  flagged: string[];
  /** The whole thing as one sentence-pair, ready to render. */
  text: string;
}

/** The short name for a criterion, falling back to its full label, then its id. */
function nameOf(criterionId: string): string {
  const criterion = findCriterion(criterionId);
  return criterion?.shortLabel ?? criterion?.label ?? criterionId;
}

/** "a", "a and b", "a, b and c" — read aloud rather than comma-separated. */
function listSentence(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

/**
 * Summarize a completed AI review's findings.
 *
 * Returns null when there is nothing to summarize — no findings at all (the run
 * failed, is still going, or this is a supervisor review). Callers render the
 * relevant state instead; an empty summary is never faked.
 */
export function summarizeAiReview(review: Pick<QualityReview, 'ai'> | null | undefined): AiReviewSummary | null {
  const findings: Record<string, AiFinding> | undefined = review?.ai?.findings;
  if (!findings) return null;

  const entries = Object.entries(findings);
  if (entries.length === 0) return null;

  // Report in rubric order, not in whatever order the model answered, so two
  // reviews of the same ticket always read the same way.
  const ordered = entries.sort(
    (a, b) => rubricIndex(a[0]) - rubricIndex(b[0]),
  );

  const passed = ordered.filter(([, f]) => f.value === 'yes').length;
  const flaggedIds = ordered.filter(([, f]) => f.value === 'no').map(([id]) => id);
  const scored = passed + flaggedIds.length;
  const flagged = flaggedIds.map(nameOf);

  const counts = `${passed} of ${scored} criteria passed.`;
  const text =
    flagged.length > 0
      ? `${counts} Attention is required for ${listSentence(flagged)}.`
      : `${counts} Nothing was flagged for attention.`;

  return { passed, scored, flagged, text };
}

/** Position of a criterion in the rubric; ids the rubric no longer has sort last. */
function rubricIndex(criterionId: string): number {
  const index = allCriteria().findIndex((c) => c.id === criterionId);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}
