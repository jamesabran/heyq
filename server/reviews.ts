/**
 * reviews — server-side module for the Quality Reviews feature (Supervisor).
 *
 * A quality review is a lead's structured assessment of how an agent handled ONE
 * ticket. This module owns review state on the same store as tickets, because the
 * workspace reads a ticket's evidence and its review together. Reviews are a
 * separate dimension: nothing here ever mutates ticket status, assignment, or any
 * handling field — the workspace is strictly read-only over the ticket.
 *
 * HTTP surface (mounted by server/http.ts):
 *   GET  /reviews                    → listReviews
 *   GET  /reviews/reviewable         → listReviewable
 *   GET  /reviews/workspace/:ticketId → getWorkspace
 *   POST /reviews/draft              → saveDraft
 *   POST /reviews/submit             → submitReview
 */
import { agents, teams } from '../src/app/data/catalog.ts';
import {
  CONCERN_TYPE_LABELS,
  STATUS_LABELS,
  type Ticket,
} from '../src/app/models/ticket.ts';
import type {
  CoachingFeedback,
  CriterionResponses,
  QualityReview,
  QualityReviewListItem,
  ReviewWorkspaceData,
  ReviewableTicket,
} from '../src/app/models/review.ts';
import { QUALITY_RUBRIC } from '../src/app/data/reviewRubric.ts';
import { computeReviewScore, missingRequired } from '../src/app/services/reviewScoring.ts';
import { clone, makeId, nowIso, simulateLatency } from '../src/app/lib/mock.ts';
import { getStore, type Store } from './store.ts';
import { getTicketDetail } from './tickets.ts';

const agentName = (id?: string) => agents.find((a) => a.id === id)?.name ?? id ?? 'Unknown';
const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? 'Unassigned';

const EMPTY_FEEDBACK: CoachingFeedback = { whatWentWell: '', areasForImprovement: '', reviewerComments: '' };

/** The single review for a ticket, if any (there is at most one). */
function reviewForTicket(store: Store, ticketId: string): QualityReview | undefined {
  return store.qualityReviews.find((r) => r.ticketId === ticketId);
}

function toListItem(store: Store, review: QualityReview): QualityReviewListItem {
  const ticket = store.tickets.find((t) => t.id === review.ticketId);
  return {
    review: clone(review),
    ticketReference: ticket?.reference ?? '—',
    ticketSubject: ticket?.subject ?? 'Unknown ticket',
    agentName: agentName(review.agentId),
    reviewerName: agentName(review.reviewerId),
    teamName: ticket ? teamName(ticket.teamId) : 'Unassigned',
  };
}

/** All reviews (draft + submitted), newest activity first. */
export async function listReviews(storeId: string): Promise<QualityReviewListItem[]> {
  await simulateLatency();
  const store = getStore(storeId);
  return store.qualityReviews
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((r) => toListItem(store, r));
}

/**
 * Tickets that CAN be reviewed but have no SUBMITTED review yet — the "To review"
 * work and an agent profile's ticket list. A ticket is reviewable only once it has
 * an assigned agent to review. A `draftReviewId` marks the ones a lead already
 * started (so the board can route them to "In progress" and the UI can resume).
 */
export async function listReviewable(storeId: string, agentId?: string): Promise<ReviewableTicket[]> {
  await simulateLatency();
  const store = getStore(storeId);

  const candidates = store.tickets.filter((t): t is Ticket & { assigneeId: string } => {
    if (!t.assigneeId) return false;
    if (agentId && t.assigneeId !== agentId) return false;
    const review = reviewForTicket(store, t.id);
    return !review || review.status !== 'submitted';
  });

  return candidates
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((t) => {
      const draft = reviewForTicket(store, t.id);
      return {
        ticketId: t.id,
        reference: t.reference,
        subject: t.subject,
        agentId: t.assigneeId,
        agentName: agentName(t.assigneeId),
        teamName: teamName(t.teamId),
        status: STATUS_LABELS[t.status],
        concernLabel: t.concernType ? CONCERN_TYPE_LABELS[t.concernType] : undefined,
        updatedAt: t.updatedAt,
        draftReviewId: draft?.status === 'draft' ? draft.id : undefined,
      };
    });
}

/** Everything the review workspace needs in one fetch: read-only evidence + review. */
export async function getWorkspace(storeId: string, ticketId: string): Promise<ReviewWorkspaceData | null> {
  const evidence = await getTicketDetail(storeId, ticketId);
  if (!evidence) return null;
  const store = getStore(storeId);
  const ticket = evidence.ticket;
  return {
    ticketId,
    // The agent under review is the ticket's handler — locked, never chosen.
    agentId: ticket.assigneeId ?? '',
    agentName: ticket.assigneeId ? agentName(ticket.assigneeId) : 'Unassigned',
    teamName: teamName(ticket.teamId),
    evidence,
    review: clone(reviewForTicket(store, ticketId) ?? null),
  };
}

export interface SaveReviewInput {
  ticketId: string;
  reviewerId: string;
  responses: CriterionResponses;
  feedback?: Partial<CoachingFeedback>;
}

/**
 * Create or update the ticket's DRAFT review. The reviewed agent is taken from the
 * ticket's assignee (locked server-side, never trusted from the client). A ticket
 * whose review is already submitted is immutable — resubmitting is refused so the
 * frozen record and its rubric version are preserved (scoring rule 4).
 */
function upsertDraft(store: Store, input: SaveReviewInput): QualityReview {
  const ticket = store.tickets.find((t) => t.id === input.ticketId);
  if (!ticket) throw new Error('Ticket not found');
  if (!ticket.assigneeId) throw new Error('This ticket has no assigned agent to review.');

  const existing = reviewForTicket(store, input.ticketId);
  if (existing?.status === 'submitted') {
    throw new Error('This ticket has already been reviewed.');
  }

  const now = nowIso();
  const feedback: CoachingFeedback = { ...EMPTY_FEEDBACK, ...existing?.feedback, ...input.feedback };

  if (existing) {
    existing.responses = { ...input.responses };
    existing.feedback = feedback;
    existing.reviewerId = input.reviewerId;
    existing.updatedAt = now;
    return existing;
  }

  const review: QualityReview = {
    id: makeId('qr'),
    ticketId: input.ticketId,
    agentId: ticket.assigneeId,
    reviewerId: input.reviewerId,
    status: 'draft',
    rubricVersion: QUALITY_RUBRIC.version,
    responses: { ...input.responses },
    feedback,
    createdAt: now,
    updatedAt: now,
  };
  store.qualityReviews.push(review);
  return review;
}

export async function saveDraft(storeId: string, input: SaveReviewInput): Promise<QualityReview> {
  await simulateLatency();
  const store = getStore(storeId);
  return clone(upsertDraft(store, input));
}

/**
 * Submit a review: every REQUIRED criterion must be answered, the score is
 * computed and FROZEN, and the rubric version is stamped so the record can always
 * be read against the exact rubric it was graded on.
 */
export async function submitReview(storeId: string, input: SaveReviewInput): Promise<QualityReview> {
  await simulateLatency();
  const store = getStore(storeId);

  const missing = missingRequired(input.responses);
  if (missing.length > 0) {
    throw new Error(`Answer every required criterion before submitting (${missing.length} left).`);
  }

  const review = upsertDraft(store, input);
  const now = nowIso();
  review.status = 'submitted';
  review.rubricVersion = QUALITY_RUBRIC.version;
  review.score = computeReviewScore(review.responses);
  review.submittedAt = now;
  review.updatedAt = now;
  return clone(review);
}
