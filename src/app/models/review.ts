// Quality Review contracts — a supervisor's structured assessment of how an agent
// handled a single ticket. Reviews are a SEPARATE dimension from ticket workflow:
// creating or submitting one NEVER changes ticket status, assignment, or any
// handling state (the workspace is read-only over the ticket). Scoring rules live
// in services/reviewScoring.ts; the rubric itself lives in data/reviewRubric.ts.

/** A criterion is answered Yes / No / N/A. "Yes" always means the standard was met. */
export type CriterionValue = 'yes' | 'no' | 'na';

export const CRITERION_VALUE_LABELS: Record<CriterionValue, string> = {
  yes: 'Yes',
  no: 'No',
  na: 'N/A',
};

/**
 * One scored line item. Phrased so that "Yes" is always the good outcome
 * (scoring rule 1). `weight` is the points a Yes earns; N/A removes the line from
 * the possible score entirely (rule 2). `required` lines must be answered before a
 * review can be submitted. `zeroTolerance` lines flag the whole review when
 * answered No — a compliance breach that a good average must never hide (rule 3).
 */
export interface RubricCriterion {
  id: string;
  label: string;
  /** Short guidance shown under the label. */
  hint?: string;
  weight: number;
  required?: boolean;
  zeroTolerance?: boolean;
}

/** A scored section groups related criteria. */
export interface RubricSection {
  id: string;
  title: string;
  description?: string;
  criteria: RubricCriterion[];
}

/**
 * A versioned rubric. The version is FROZEN onto every submitted review so a
 * historical score can always be read against the exact rubric it was graded on,
 * even after the rubric is later revised (scoring rule 4).
 */
export interface Rubric {
  version: string;
  /** Scored sections (Yes/No/N/A criteria). */
  sections: RubricSection[];
}

export type ReviewStatus = 'draft' | 'submitted';

/**
 * Who authored a review. A ticket may carry ONE supervisor review and, alongside
 * it, an AI review — they are separate records that never merge, never overwrite
 * each other, and are never inferred from the reviewer's name.
 */
export type ReviewType = 'supervisor' | 'ai';

export const REVIEW_TYPE_LABELS: Record<ReviewType, string> = {
  supervisor: 'Supervisor review',
  ai: 'AI review',
};

/**
 * The type of a review record. `reviewType` is OPTIONAL on the record so reviews
 * written before the field existed keep behaving as supervisor reviews; every new
 * write stamps it explicitly. Read the type through here, never off the raw field.
 */
export function reviewTypeOf(review: Pick<QualityReview, 'reviewType'>): ReviewType {
  return review.reviewType ?? 'supervisor';
}

/** A single answer, stored as a map keyed by criterion id on the review. */
export type CriterionResponses = Record<string, CriterionValue>;

/** The free-text coaching section — never scored. */
export interface CoachingFeedback {
  whatWentWell: string;
  areasForImprovement: string;
  reviewerComments: string;
}

/**
 * The computed outcome of a set of responses against a rubric. Recomputed live
 * while drafting and FROZEN onto the review at submission.
 */
export interface ReviewScore {
  /** Points earned (sum of weights answered Yes). */
  earned: number;
  /** Points possible (sum of weights answered Yes or No — N/A excluded). */
  possible: number;
  /** earned / possible as a 0–100 percentage; null when nothing is scorable yet. */
  percent: number | null;
  /** Ids of zero-tolerance criteria answered No. Non-empty ⇒ a flagged review. */
  zeroToleranceFailures: string[];
  /** How many criteria still need an answer to submit (required, unanswered). */
  unansweredRequired: number;
}

/** A quality review record (draft or submitted). */
export interface QualityReview {
  id: string;
  ticketId: string;
  /** The agent being reviewed — the ticket's handler. Locked at creation. */
  agentId: string;
  /**
   * The supervisor / lead / reviewer who owns this review. On an AI review this
   * is the placeholder reviewer id `ai` — the record has no human owner.
   */
  reviewerId: string;
  /** Omitted ⇒ 'supervisor'. Read it through `reviewTypeOf`, never directly. */
  reviewType?: ReviewType;
  status: ReviewStatus;
  /** The rubric version these responses were graded against (frozen on submit). */
  rubricVersion: string;
  responses: CriterionResponses;
  feedback: CoachingFeedback;
  /** Frozen score — present only once submitted. */
  score?: ReviewScore;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string;
}

// ── View models (composed by the server for review screens) ──────────────────

/** A review enriched with the human labels the list/board needs. */
export interface QualityReviewListItem {
  review: QualityReview;
  ticketReference: string;
  ticketSubject: string;
  agentName: string;
  reviewerName: string;
  teamName: string;
}

/**
 * A ticket that CAN be reviewed but has no submitted SUPERVISOR review yet — the
 * "To review" column and an agent profile's ticket list. `draftReviewId` is set
 * when a lead has a draft in flight, so the UI can resume it instead of starting
 * fresh. `aiReviewId` marks tickets an AI review already exists for; it is a
 * label only and never removes the ticket from the supervisor's queue.
 */
export interface ReviewableTicket {
  ticketId: string;
  reference: string;
  subject: string;
  agentId: string;
  agentName: string;
  teamName: string;
  status: string;
  concernLabel?: string;
  updatedAt: string;
  draftReviewId?: string;
  aiReviewId?: string;
}

/**
 * Everything the review workspace needs in one fetch: evidence + the reviews that
 * exist for this ticket. The two review slots are kept SEPARATE — an AI review
 * never populates, prefills, or overwrites the supervisor review.
 */
export interface ReviewWorkspaceData {
  ticketId: string;
  agentId: string;
  agentName: string;
  teamName: string;
  /** Read-only ticket evidence (same shape the agent detail view uses). */
  evidence: import('./ticket').TicketDetailView;
  /** The current draft/submitted SUPERVISOR review for this ticket, if any. */
  review: QualityReview | null;
  /** The latest AI review for this ticket, if any. Read-only context. */
  aiReview: QualityReview | null;
}
