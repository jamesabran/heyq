/**
 * reviewService — thin HTTP client over the HeyQ mock API server
 * (server/reviews.ts) for the Quality Reviews feature. Mirrors ticketService's
 * shape: every function is a fetch call; the server owns all review state.
 *
 * Endpoints (server/http.ts):
 *   GET  /reviews                     → listReviews
 *   GET  /reviews/reviewable          → listReviewable
 *   GET  /reviews/workspace/:ticketId → getReviewWorkspace
 *   POST /reviews/draft               → saveDraft
 *   POST /reviews/submit              → submitReview
 */
import type {
  CoachingFeedback,
  CriterionResponses,
  QualityReview,
  QualityReviewListItem,
  ReviewWorkspaceData,
  ReviewableTicket,
} from '../models/review';
import { ApiError, apiGet, apiPost, buildQuery } from '../lib/apiClient';

export async function listReviews(): Promise<QualityReviewListItem[]> {
  return apiGet<QualityReviewListItem[]>('/reviews');
}

export async function listReviewable(agentId?: string): Promise<ReviewableTicket[]> {
  return apiGet<ReviewableTicket[]>(`/reviews/reviewable${buildQuery({ agentId })}`);
}

export async function getReviewWorkspace(ticketId: string): Promise<ReviewWorkspaceData | null> {
  try {
    return await apiGet<ReviewWorkspaceData>(`/reviews/workspace/${ticketId}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export interface SaveReviewInput {
  ticketId: string;
  reviewerId: string;
  responses: CriterionResponses;
  feedback?: Partial<CoachingFeedback>;
}

export async function saveDraft(input: SaveReviewInput): Promise<QualityReview> {
  return apiPost<QualityReview>('/reviews/draft', input);
}

export async function submitReview(input: SaveReviewInput): Promise<QualityReview> {
  return apiPost<QualityReview>('/reviews/submit', input);
}

/**
 * Run an AI review for a ticket and return the resulting AI record. The actor is
 * sent so the SERVER can enforce the review-role restriction — the button being
 * hidden is a convenience, not the control.
 *
 * Never touches the supervisor review: a failed or low-scoring AI result changes
 * nothing about the form the supervisor is filling in.
 */
export async function runAiReview(ticketId: string, actorId: string): Promise<QualityReview> {
  return apiPost<QualityReview>('/reviews/ai/run', { ticketId, actorId });
}
