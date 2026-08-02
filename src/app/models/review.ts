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

  // ── AI reviews only (reviewType === 'ai'); absent on supervisor records ────
  /** How this review was produced, and whether it succeeded. */
  ai?: AiReviewMeta;
  /**
   * Whether a supervisor must still review this ticket. FROZEN at write time
   * together with `thresholdPercent`, so a later threshold change can never
   * silently rewrite a completed review — the same convention as rubricVersion.
   */
  supervisorReviewRequired?: boolean;
  supervisorReviewReason?: SupervisorRequiredReason;
  /** The threshold this review was assessed against. */
  thresholdPercent?: number;
}

// ── AI reviews ───────────────────────────────────────────────────────────────

/**
 * Where an AI review is in its lifecycle. Phase 1 runs synchronously on an
 * explicit request, so a record is only ever briefly `running` — the state exists
 * so the shape does not have to change when the run moves to a background job.
 */
export type AiProcessingStatus = 'running' | 'succeeded' | 'failed';

/** Why a supervisor must still look at a ticket the AI has already reviewed. */
export type SupervisorRequiredReason = 'low_score' | 'zero_tolerance' | 'ai_failed' | 'unscorable';

export const SUPERVISOR_REQUIRED_REASON_LABELS: Record<SupervisorRequiredReason, string> = {
  low_score: 'The AI score is below the review threshold.',
  zero_tolerance: 'The AI reported a zero-tolerance finding.',
  ai_failed: 'The AI reviewer could not complete this review.',
  unscorable: 'The AI review produced nothing scorable.',
};

/**
 * One criterion's AI answer.
 *
 * `rationale` says why, `evidence` quotes the transcript it came from. Both are
 * required: a supervisor has to be able to check an answer against what was
 * actually said, and a rationale with nothing behind it is unverifiable.
 *
 * `confidence` (0–1) is displayed but deliberately NOT load-bearing — model
 * self-reported confidence is poorly calibrated, so nothing about whether a
 * supervisor review is required depends on it.
 */
export interface AiFinding {
  value: CriterionValue;
  rationale: string;
  /** A short verbatim excerpt from the conversation supporting the answer. */
  evidence: string;
  confidence?: number;
}

/** Why an AI review failed. `code` is stable for tests/telemetry; `message` is human. */
export interface AiReviewError {
  code: string;
  message: string;
}

/**
 * The AI-specific half of a review record. Everything a supervisor needs to judge
 * whether the AI's assessment can be trusted: what produced it, when, and — when
 * it failed — why.
 */
export interface AiReviewMeta {
  /** Which provider produced this (`fake`, `huggingface`, …). */
  provider: string;
  model: string;
  /**
   * The resolved model revision, when the host reports one. Absent whenever it
   * does not — never fabricated, since a wrong version on a frozen review is
   * worse than no version.
   */
  modelVersion?: string;
  /** Bumped when the prompt template changes — the prompt's analogue of rubricVersion. */
  promptVersion: string;
  status: AiProcessingStatus;
  requestedAt: string;
  completedAt?: string;
  /** Round-trip time of the provider call, when it reported one. */
  latencyMs?: number;
  /** Per-criterion answers + rationales. Present only once succeeded. */
  findings?: Record<string, AiFinding>;
  /** Present only once failed. */
  error?: AiReviewError;
}

/**
 * Rolling health of the AI reviewer, updated after every provider attempt.
 * Deliberately tiny: enough to tell "one blip" from "consistently broken",
 * without becoming a metrics system inside an in-memory store.
 */
export interface AiHealth {
  consecutiveFailures: number;
  lastErrorCode?: string;
  lastErrorAt?: string;
  lastSuccessAt?: string;
}

/**
 * Server-owned AI Review configuration. Lives in the store (server/seed.ts) and is
 * read by the server on every run — never browser module state, and never an
 * environment variable at decision time.
 */
export interface AiReviewConfig {
  enabled: boolean;
  /**
   * An AI score BELOW this requires a supervisor review. Integer 0–100, the same
   * range as ReviewScore.percent. Frozen onto each review as `thresholdPercent`.
   */
  thresholdPercent: number;
  model: string;
  promptVersion: string;
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
