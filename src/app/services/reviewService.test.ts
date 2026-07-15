import { describe, expect, it } from 'vitest';
import {
  getReviewWorkspace,
  listReviewable,
  listReviews,
  saveDraft,
  submitReview,
} from './reviewService';
import { computeReviewScore } from './reviewScoring';
import { QUALITY_RUBRIC } from '../data/reviewRubric';
import type { CriterionResponses } from '../models/review';

/** Answer every criterion Yes — a complete, submittable set. */
function allYes(): CriterionResponses {
  return Object.fromEntries(
    QUALITY_RUBRIC.sections.flatMap((s) => s.criteria).map((c) => [c.id, 'yes' as const]),
  );
}

describe('review listings', () => {
  it('returns the seeded reviews (one completed, one draft)', async () => {
    const reviews = await listReviews();
    const submitted = reviews.find((r) => r.review.id === 'qr-seed-1');
    const draft = reviews.find((r) => r.review.id === 'qr-seed-2');
    expect(submitted?.review.status).toBe('submitted');
    expect(submitted?.review.score?.percent).toBe(96); // one N/A + one No, no flags
    expect(draft?.review.status).toBe('draft');
  });

  it('lists assigned tickets to review, excludes submitted-reviewed ones, marks drafts', async () => {
    const reviewable = await listReviewable();
    const ids = reviewable.map((t) => t.ticketId);
    expect(ids).toContain('tkt-seed-10'); // assigned, no review
    expect(ids).not.toContain('tkt-bp-3'); // already has a submitted review
    // tkt-seed-7 carries a seeded draft, so it surfaces with a draftReviewId.
    expect(reviewable.find((t) => t.ticketId === 'tkt-seed-7')?.draftReviewId).toBe('qr-seed-2');
  });

  it('scopes reviewable tickets to one agent', async () => {
    const forL2 = await listReviewable('l2_specialist');
    expect(forL2.every((t) => t.agentId === 'l2_specialist')).toBe(true);
  });
});

describe('review workspace', () => {
  it('bundles read-only evidence with the locked agent and no review yet', async () => {
    const ws = await getReviewWorkspace('tkt-seed-8');
    expect(ws?.agentId).toBe('l1_agent'); // the ticket's assignee, locked
    expect(ws?.evidence.ticket.reference).toBe('HQ-2026-0008');
    expect(ws?.evidence.messages.length).toBeGreaterThan(0);
    expect(ws?.review).toBeNull();
  });
});

describe('drafts', () => {
  it('creates a draft with the agent locked to the ticket assignee', async () => {
    const draft = await saveDraft({
      ticketId: 'tkt-seed-5',
      reviewerId: 'team_lead',
      responses: { empathy: 'yes' },
      feedback: { whatWentWell: 'Quick to respond.', areasForImprovement: '', reviewerComments: '' },
    });
    expect(draft.status).toBe('draft');
    expect(draft.agentId).toBe('l1_agent'); // never taken from the client
    expect(draft.reviewerId).toBe('team_lead');

    // Re-opening the workspace returns the saved draft.
    const ws = await getReviewWorkspace('tkt-seed-5');
    expect(ws?.review?.id).toBe(draft.id);
    expect(ws?.review?.responses.empathy).toBe('yes');
  });

  it('refuses to review a ticket with no assigned agent', async () => {
    await expect(
      saveDraft({ ticketId: 'tkt-seed-3', reviewerId: 'team_lead', responses: {} }),
    ).rejects.toThrow(/no assigned agent/i);
  });
});

describe('submission', () => {
  it('blocks submission until every required criterion is answered', async () => {
    await expect(
      submitReview({ ticketId: 'tkt-seed-16', reviewerId: 'team_lead', responses: { greeting: 'yes' } }),
    ).rejects.toThrow(/required/i);
  });

  it('freezes the score and rubric version on submit, then locks the review', async () => {
    const responses = { ...allYes(), set_expectations: 'na' as const, timely_handling: 'no' as const };
    const submitted = await submitReview({ ticketId: 'tkt-seed-4', reviewerId: 'team_lead', responses });

    expect(submitted.status).toBe('submitted');
    expect(submitted.rubricVersion).toBe('v1');
    expect(submitted.submittedAt).toEqual(expect.any(String));
    // The frozen score matches a fresh computation from the same responses.
    expect(submitted.score?.percent).toBe(computeReviewScore(responses).percent);

    // A submitted review is immutable — resubmitting is refused.
    await expect(
      submitReview({ ticketId: 'tkt-seed-4', reviewerId: 'team_lead', responses }),
    ).rejects.toThrow(/already been reviewed/i);
  });
});
