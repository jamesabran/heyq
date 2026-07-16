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
