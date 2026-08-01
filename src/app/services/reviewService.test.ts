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
import { reviewTypeOf, type CriterionResponses } from '../models/review';

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
    // A manual draft is stored EXPLICITLY as a supervisor review.
    expect(draft.reviewType).toBe('supervisor');

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
    expect(submitted.reviewType).toBe('supervisor'); // stored explicitly
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

describe('review types', () => {
  it('reads reviews written before `reviewType` existed as supervisor reviews', async () => {
    const reviews = await listReviews();
    const submitted = reviews.find((r) => r.review.id === 'qr-seed-1')!;
    const draft = reviews.find((r) => r.review.id === 'qr-seed-2')!;

    // The seeded records carry no `reviewType` at all — they stand in for rows
    // written before the field existed, and must still behave as supervisor work.
    expect(submitted.review.reviewType).toBeUndefined();
    expect(reviewTypeOf(submitted.review)).toBe('supervisor');
    expect(reviewTypeOf(draft.review)).toBe('supervisor');
  });

  it('reads the seeded AI review as an AI review, named from its type', async () => {
    const reviews = await listReviews();
    const ai = reviews.find((r) => r.review.id === 'qr-seed-3')!;
    expect(reviewTypeOf(ai.review)).toBe('ai');
    // The reviewer label comes from the TYPE, never from a raw placeholder id.
    expect(ai.reviewerName).toBe('AI reviewer');
  });

  it('keeps a supervisor draft resumable and stamps its type on the next save', async () => {
    const before = await getReviewWorkspace('tkt-seed-7');
    expect(before?.review?.id).toBe('qr-seed-2');
    expect(before?.review?.status).toBe('draft');

    // Resuming it updates the SAME record rather than starting a new one.
    const resumed = await saveDraft({
      ticketId: 'tkt-seed-7',
      reviewerId: 'team_lead',
      responses: { ...before!.review!.responses, clarity: 'yes' },
    });
    expect(resumed.id).toBe('qr-seed-2');
    expect(resumed.status).toBe('draft');
    expect(resumed.reviewType).toBe('supervisor');
    expect(resumed.responses.clarity).toBe('yes');
  });
});

/**
 * tkt-bp-4 carries a seeded AI review and no supervisor review. These run in
 * order against one store: the ticket is queued for review, a lead starts their
 * own review of it, and only their SUBMITTED review takes it out of the queue.
 */
describe('an AI review coexists with a supervisor review', () => {
  const AI_TICKET = 'tkt-bp-4';

  it('does not remove the ticket from the supervisor queue', async () => {
    const reviewable = await listReviewable();
    const entry = reviewable.find((t) => t.ticketId === AI_TICKET);
    // Still queued, and labelled so a lead knows AI context exists.
    expect(entry).toBeDefined();
    expect(entry?.aiReviewId).toBe('qr-seed-3');
    expect(entry?.draftReviewId).toBeUndefined();
  });

  it('returns the AI review and the (absent) supervisor review separately', async () => {
    const ws = await getReviewWorkspace(AI_TICKET);
    expect(ws?.review).toBeNull(); // no supervisor review yet
    expect(ws?.aiReview?.id).toBe('qr-seed-3');
    expect(reviewTypeOf(ws!.aiReview!)).toBe('ai');
  });

  it('lets a lead start a supervisor review alongside the AI review', async () => {
    const draft = await saveDraft({
      ticketId: AI_TICKET,
      reviewerId: 'team_lead',
      responses: { empathy: 'no' }, // deliberately disagreeing with the AI
    });
    expect(draft.reviewType).toBe('supervisor');
    expect(draft.id).not.toBe('qr-seed-3'); // a NEW record, not the AI one

    // Both records exist on the ticket, in separate slots, neither overwritten.
    const ws = await getReviewWorkspace(AI_TICKET);
    expect(ws?.review?.id).toBe(draft.id);
    expect(ws?.review?.responses.empathy).toBe('no');
    expect(ws?.aiReview?.id).toBe('qr-seed-3');
    expect(ws?.aiReview?.responses.empathy).toBe('yes'); // AI answers untouched
  });

  it('removes the ticket only once the SUPERVISOR review is submitted', async () => {
    const submitted = await submitReview({
      ticketId: AI_TICKET,
      reviewerId: 'team_lead',
      responses: allYes(),
    });
    expect(submitted.reviewType).toBe('supervisor');
    expect(submitted.score?.percent).toBe(100);

    const reviewable = await listReviewable();
    expect(reviewable.map((t) => t.ticketId)).not.toContain(AI_TICKET);

    // The AI review survives submission untouched, and both are still returned.
    const ws = await getReviewWorkspace(AI_TICKET);
    expect(ws?.review?.id).toBe(submitted.id);
    expect(ws?.aiReview?.id).toBe('qr-seed-3');
    expect(ws?.aiReview?.status).toBe('submitted');
  });
});
