import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  getReviewWorkspace,
  listReviewable,
  listReviews,
  runAiReview,
  saveDraft,
  submitReview,
} from './reviewService';
import { ApiError } from '../lib/apiClient';
// The test API server runs in THIS file's module registry (src/test/setup.ts),
// so the store and provider seam reached over HTTP are the same instances.
import { getStore } from '../../../server/store';
import { DEFAULT_REVIEW_CONFIG } from '../../../server/seed';
import {
  unavailableAiProvider,
  __resetAiReviewProviderForTest,
  __setAiReviewProviderForTest,
} from '../../../server/aiReviewProvider';
import { computeReviewScore } from './reviewScoring';
import { QUALITY_RUBRIC } from '../data/reviewRubric';
import { reviewTypeOf, type CriterionResponses } from '../models/review';

/** Answer every criterion Yes — a complete, submittable set. */
function allYes(): CriterionResponses {
  return Object.fromEntries(
    QUALITY_RUBRIC.sections.flatMap((s) => s.criteria).map((c) => [c.id, 'yes' as const]),
  );
}

// AI reviews are switched OFF by default (HEYQ_AI_REVIEW_ENABLED). The tests
// that run one opt in explicitly, the same way a deployment has to; the
// disabled path is covered in `POST /reviews/ai/run` below.
beforeEach(() => {
  process.env.HEYQ_AI_REVIEW_ENABLED = 'true';
});

afterEach(() => {
  delete process.env.HEYQ_AI_REVIEW_ENABLED;
});

describe('review listings', () => {
  it('returns the seeded reviews (one completed, one draft)', async () => {
    const reviews = await listReviews();
    const submitted = reviews.find((r) => r.review.id === 'qr-seed-1');
    const draft = reviews.find((r) => r.review.id === 'qr-seed-2');
    expect(submitted?.review.status).toBe('submitted');
    expect(submitted?.review.score?.percent).toBe(96); // one N/A + one No, no flags
    expect(draft?.review.status).toBe('draft');
  });

  it('lists finished assigned tickets, and excludes submitted-reviewed ones', async () => {
    const reviewable = await listReviewable();
    const ids = reviewable.map((t) => t.ticketId);
    expect(ids).toContain('tkt-seed-15'); // resolved + assigned, no review
    expect(ids).toContain('tkt-seed-16'); // closed + assigned, no review
    expect(ids).not.toContain('tkt-bp-3'); // already has a submitted review
    expect(ids).not.toContain('tkt-seed-10'); // on hold — still being worked
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

// tkt-seed-16 is CLOSED and assigned — a finished ticket, which is the only kind
// a review applies to. These run in order against one store: a draft is started
// on it, resumed, and finally submitted in `submission` below.
const FINISHED_TICKET = 'tkt-seed-16';

describe('drafts', () => {
  it('creates a draft with the agent locked to the ticket assignee', async () => {
    const draft = await saveDraft({
      ticketId: FINISHED_TICKET,
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
    const ws = await getReviewWorkspace(FINISHED_TICKET);
    expect(ws?.review?.id).toBe(draft.id);
    expect(ws?.review?.responses.empathy).toBe('yes');
  });

  it('resumes the same record on the next save rather than starting a new one', async () => {
    const before = await getReviewWorkspace(FINISHED_TICKET);
    const resumed = await saveDraft({
      ticketId: FINISHED_TICKET,
      reviewerId: 'team_lead',
      responses: { ...before!.review!.responses, clarity: 'yes' },
    });
    expect(resumed.id).toBe(before!.review!.id);
    expect(resumed.status).toBe('draft');
    expect(resumed.reviewType).toBe('supervisor');
    expect(resumed.responses.clarity).toBe('yes');
  });

  it('refuses to review a ticket with no assigned agent', async () => {
    await expect(
      saveDraft({ ticketId: 'tkt-seed-3', reviewerId: 'team_lead', responses: {} }),
    ).rejects.toThrow(/no assigned agent/i);
  });

  it('refuses to review a ticket that is still being worked', async () => {
    // tkt-seed-4 is in progress. The agent has not finished handling it, so
    // there is nothing to assess — and the server says so rather than relying on
    // the UI having hidden the form.
    await expect(
      saveDraft({ ticketId: 'tkt-seed-4', reviewerId: 'team_lead', responses: { empathy: 'yes' } }),
    ).rejects.toThrow(/resolve the ticket before reviewing it/i);
  });
});

describe('submission', () => {
  it('blocks submission until every required criterion is answered', async () => {
    await expect(
      submitReview({ ticketId: FINISHED_TICKET, reviewerId: 'team_lead', responses: { greeting: 'yes' } }),
    ).rejects.toThrow(/required/i);
  });

  it('freezes the score and rubric version on submit, then locks the review', async () => {
    const responses = { ...allYes(), set_expectations: 'na' as const, timely_handling: 'no' as const };
    const submitted = await submitReview({ ticketId: FINISHED_TICKET, reviewerId: 'team_lead', responses });

    expect(submitted.status).toBe('submitted');
    expect(submitted.reviewType).toBe('supervisor'); // stored explicitly
    expect(submitted.rubricVersion).toBe('v1');
    expect(submitted.submittedAt).toEqual(expect.any(String));
    // The frozen score matches a fresh computation from the same responses.
    expect(submitted.score?.percent).toBe(computeReviewScore(responses).percent);

    // A submitted review is immutable — resubmitting is refused.
    await expect(
      submitReview({ ticketId: FINISHED_TICKET, reviewerId: 'team_lead', responses }),
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

  it('keeps a draft on a still-active ticket readable, but refuses to save over it', async () => {
    // tkt-seed-7 carries a seeded draft and is still in progress — the shape a
    // reopened ticket leaves behind. History is preserved and readable; only NEW
    // review work is blocked.
    const before = await getReviewWorkspace('tkt-seed-7');
    expect(before?.review?.id).toBe('qr-seed-2');
    expect(before?.review?.status).toBe('draft');

    await expect(
      saveDraft({
        ticketId: 'tkt-seed-7',
        reviewerId: 'team_lead',
        responses: { ...before!.review!.responses, clarity: 'yes' },
      }),
    ).rejects.toThrow(/resolve the ticket before reviewing it/i);

    const after = await getReviewWorkspace('tkt-seed-7');
    expect(after?.review).toEqual(before?.review); // untouched, not partially written
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

/**
 * The internal AI-run endpoint (POST /reviews/ai/run), exercised over real HTTP
 * so the ROUTE's role check and disabled-refusal are proven — not just the
 * orchestration underneath them.
 */
describe('POST /reviews/ai/run', () => {
  afterEach(() => {
    __resetAiReviewProviderForTest();
    getStore('default').reviewConfig = { ...DEFAULT_REVIEW_CONFIG };
  });

  it('runs a review for a team lead and returns the AI record', async () => {
    const review = await runAiReview('tkt-seed-15', 'team_lead');
    expect(review.reviewType).toBe('ai');
    expect(review.ai?.status).toBe('succeeded');
    expect(review.score?.percent).toEqual(expect.any(Number));
  });

  it('refuses a non-review role with 403, server-side', async () => {
    // The button being hidden is a convenience; THIS is the control.
    await expect(runAiReview('tkt-seed-15', 'l1_agent')).rejects.toMatchObject({ status: 403 });
    await expect(runAiReview('tkt-seed-15', 'kb_editor')).rejects.toBeInstanceOf(ApiError);
  });

  it('refuses an unknown or missing actor', async () => {
    await expect(runAiReview('tkt-seed-15', 'nobody')).rejects.toMatchObject({ status: 403 });
    await expect(runAiReview('tkt-seed-15', '')).rejects.toMatchObject({ status: 403 });
  });

  it('refuses to run when AI reviews are disabled', async () => {
    getStore('default').reviewConfig.enabled = false;
    await expect(runAiReview('tkt-seed-15', 'team_lead')).rejects.toThrow(/disabled/i);
  });

  it('returns a failed record — not an HTTP error — when the provider is down', async () => {
    // A model being unavailable is an AI outcome, not a broken request: the
    // caller still gets a review record it can render.
    __setAiReviewProviderForTest(unavailableAiProvider);
    const review = await runAiReview('tkt-seed-16', 'team_lead');
    expect(review.ai?.status).toBe('failed');
    expect(review.supervisorReviewRequired).toBe(true);
    expect(review.supervisorReviewReason).toBe('ai_failed');
  });

  it('returns a failed record — not an HTTP error — when AI reviews are switched off', async () => {
    // The deployment switch is a setting, not a broken request: the caller still
    // gets a review record it can render, exactly as when the model is down.
    delete process.env.HEYQ_AI_REVIEW_ENABLED;

    const review = await runAiReview('tkt-seed-16', 'team_lead');

    expect(review.ai?.status).toBe('failed');
    expect(review.ai?.error?.code).toBe('disabled');
    expect(review.supervisorReviewRequired).toBe(true);
    expect(review.supervisorReviewReason).toBe('ai_failed');
  });

  it('surfaces the AI review through the workspace without touching the supervisor slot', async () => {
    await runAiReview('tkt-seed-15', 'admin');
    const ws = await getReviewWorkspace('tkt-seed-15');
    expect(ws?.aiReview?.reviewType).toBe('ai');
    expect(ws?.aiReview?.ai?.findings).toBeDefined();
    // tkt-seed-15 has no supervisor review, and running the AI did not create one.
    expect(ws?.review).toBeNull();
  });

  it('leaves the ticket in the supervisor queue after a successful AI run', async () => {
    await runAiReview('tkt-seed-15', 'team_lead');
    const reviewable = await listReviewable();
    const entry = reviewable.find((t) => t.ticketId === 'tkt-seed-15');
    expect(entry).toBeDefined();
    expect(entry?.aiReviewId).toBeDefined();
  });
});

/**
 * Eligibility over real HTTP. The workspace hides these actions for an active
 * ticket, but a request that never went near the UI must be refused just the
 * same — the hidden button is a convenience, the server is the control.
 */
describe('eligibility cannot be bypassed by calling the API directly', () => {
  // tkt-seed-4 is in progress and assigned; tkt-seed-1 is on hold and unassigned.
  const ACTIVE = 'tkt-seed-4';

  it('refuses an AI run', async () => {
    await expect(runAiReview(ACTIVE, 'team_lead')).rejects.toMatchObject({
      status: 400,
      message: expect.stringMatching(/resolve the ticket before reviewing it/i),
    });
  });

  it('refuses a supervisor draft', async () => {
    await expect(
      saveDraft({ ticketId: ACTIVE, reviewerId: 'team_lead', responses: { empathy: 'yes' } }),
    ).rejects.toMatchObject({ status: 400 });
  });

  it('refuses a supervisor submission', async () => {
    await expect(
      submitReview({ ticketId: ACTIVE, reviewerId: 'team_lead', responses: allYes() }),
    ).rejects.toThrow(/resolve the ticket before reviewing it/i);
  });

  it('leaves no trace of a refused request', async () => {
    const ws = await getReviewWorkspace(ACTIVE);
    expect(ws?.review).toBeNull();
    expect(ws?.aiReview).toBeNull();
  });
});
