/**
 * Resolving a ticket, end to end over HTTP: does the stored ticket actually
 * change status, and does exactly one automatic AI review follow?
 *
 * Every assertion about the ticket here reads it back with a SEPARATE request
 * (`getTicketById`) rather than trusting the resolve call's own response body. A
 * mutation that returns `{status: 'resolved'}` proves only what the handler
 * computed; re-reading proves what it stored. The review side is read the same
 * way, through `/reviews`, never from a returned object.
 *
 * These go through the service layer — the same functions the ticket screen
 * calls — so nothing here can pass on optimistic or component-local state.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getTicketById, resolveTicket } from './ticketService';
import { listReviews, saveDraft } from './reviewService';
// The test API server shares this file's module registry (src/test/setup.ts), so
// the store reached over HTTP is the same instance these helpers inspect.
import { __settleAiReviewsForTest } from '../../../server/aiReview';
import { __resetAiReviewProviderForTest } from '../../../server/aiReviewProvider';

/** tkt-seed-4 is in progress and assigned to l1_agent — active, and reviewable once finished. */
const TICKET = 'tkt-seed-4';

/** The ticket's AI reviews, read back over HTTP rather than from any return value. */
async function storedAiReviews(ticketId: string) {
  const all = await listReviews();
  return all.filter((r) => r.review.ticketId === ticketId && r.review.reviewType === 'ai');
}

/** Resolve, then let the background review settle so its result can be asserted. */
async function resolveAndSettle(ticketId = TICKET) {
  const returned = await resolveTicket(ticketId, 'l1_agent', 'solved');
  await __settleAiReviewsForTest();
  return returned;
}

beforeEach(() => {
  process.env.HEYQ_AI_REVIEW_ENABLED = 'true';
});

afterEach(() => {
  __resetAiReviewProviderForTest();
  delete process.env.HEYQ_AI_REVIEW_ENABLED;
});

describe('resolving a ticket over HTTP', () => {
  it('stores the new status, and a re-read confirms it', async () => {
    const before = await getTicketById(TICKET);
    expect(before?.status).toBe('in_progress');
    expect(before?.resolvedAt).toBeUndefined();

    const returned = await resolveAndSettle();
    expect(returned.status).toBe('resolved'); // what the handler computed…

    // …and what it actually stored, on a separate request.
    const stored = await getTicketById(TICKET);
    expect(stored?.status).toBe('resolved');
    expect(stored?.resolvedAt).toEqual(expect.any(String));
    expect(stored?.resolutionType).toBe('solved');
  });

  it('starts exactly one AI review off the back of that stored transition', async () => {
    const reviews = await storedAiReviews(TICKET);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].review.ai?.trigger).toBe('automatic');
    expect(reviews[0].review.ai?.status).toBe('succeeded');
    expect(reviews[0].review.score?.percent).toEqual(expect.any(Number));
  });

  it('does not duplicate the review when the request is repeated', async () => {
    // A retry, a double-click, a client that replays the call.
    await resolveAndSettle();
    await resolveAndSettle();
    await resolveAndSettle();

    expect(await storedAiReviews(TICKET)).toHaveLength(1);
    expect((await getTicketById(TICKET))?.status).toBe('resolved');
  });

  it('leaves the manual supervisor flow exactly as it was', async () => {
    // The ticket is resolved and AI-reviewed; a lead can still write their own
    // review, and it is a separate record the AI's does not bleed into.
    const aiBefore = structuredClone((await storedAiReviews(TICKET))[0].review);

    const draft = await saveDraft({ ticketId: TICKET, reviewerId: 'team_lead', responses: { empathy: 'no' } });
    expect(draft.reviewType).toBe('supervisor');
    expect(draft.id).not.toBe(aiBefore.id);

    const ai = await storedAiReviews(TICKET);
    expect(ai).toHaveLength(1);
    expect(ai[0].review).toEqual(aiBefore); // the AI record is byte-for-byte untouched
  });
});

describe('a resolve that never stores a transition', () => {
  it('creates no AI review when the ticket does not exist', async () => {
    const before = (await listReviews()).length;

    await expect(resolveTicket('tkt-does-not-exist', 'l1_agent', 'solved')).rejects.toThrow(/not found/i);
    await __settleAiReviewsForTest();

    // The handler threw before writing anything, so the trigger never ran — the
    // review is a consequence of a stored transition, never of an attempted one.
    expect((await listReviews()).length).toBe(before);
  });
});
