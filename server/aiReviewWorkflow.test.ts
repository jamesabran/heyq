/**
 * The review WORKFLOW: when a quality review may exist at all, and who starts it.
 *
 * Two product rules are proven here, and everything else follows from them:
 *
 *   1. A review applies only to FINISHED handling. An active ticket cannot
 *      receive an AI review, an AI re-run, or a supervisor review — enforced on
 *      the server, so hiding the buttons is a convenience and not the control.
 *
 *   2. Resolving a ticket starts exactly ONE automatic AI review, in the
 *      background. Resolution never waits for it, and never produces a second
 *      one however many times the request is repeated or retried.
 *
 * Reopening is the interesting case both rules meet: the previous cycle's
 * reviews survive untouched, new review work is blocked while the ticket is
 * active again, and resolving it a second time opens a NEW cycle rather than
 * overwriting the first.
 *
 * These use a store of their own so the seed's own reviews cannot mask a bug.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  runAiReview,
  startAutomaticAiReview,
  __settleAiReviewsForTest,
} from './aiReview.ts';
import {
  scriptedAiProvider,
  unavailableAiProvider,
  type AiGradeResult,
  type AiReviewProvider,
  __resetAiReviewProviderForTest,
  __setAiReviewProviderForTest,
} from './aiReviewProvider.ts';
import {
  aiReviewsForTicket,
  latestAiReviewForTicket,
  listReviewable,
  listReviews,
  saveDraft,
  submitReview,
} from './reviews.ts';
import { addRequesterMessage, reopenTicket, resolveTicket } from './tickets.ts';
import { getStore, resetStore } from './store.ts';
import { QUALITY_RUBRIC, allCriteria } from '../src/app/data/reviewRubric.ts';
import type { CriterionValue, QualityReview } from '../src/app/models/review.ts';

const S = 'review-workflow';

/** tkt-seed-4 is IN PROGRESS and assigned to l1_agent — an active ticket. */
const ACTIVE = 'tkt-seed-4';
/** tkt-seed-5 is OPEN and assigned to l1_agent — resolved by these tests. */
const TICKET = 'tkt-seed-5';

const answers = (overrides: Record<string, CriterionValue> = {}) => ({
  ...Object.fromEntries(allCriteria(QUALITY_RUBRIC).map((c) => [c.id, 'yes' as CriterionValue])),
  ...overrides,
});

const aiReviews = (ticketId: string): QualityReview[] => aiReviewsForTicket(getStore(S), ticketId);

const resolve = (ticketId = TICKET) => resolveTicket(S, ticketId, 'l1_agent', 'solved');

/** Resolve and let the background review finish, for assertions about its result. */
async function resolveAndSettle(ticketId = TICKET) {
  const ticket = await resolve(ticketId);
  await __settleAiReviewsForTest();
  return ticket;
}

beforeEach(() => {
  resetStore(S);
  process.env.HEYQ_AI_REVIEW_ENABLED = 'true';
});

afterEach(() => {
  __resetAiReviewProviderForTest();
  delete process.env.HEYQ_AI_REVIEW_ENABLED;
});

describe('an active ticket cannot be reviewed', () => {
  it('refuses an AI review', async () => {
    await expect(runAiReview(S, ACTIVE)).rejects.toThrow(/resolve the ticket before reviewing it/i);
    expect(aiReviews(ACTIVE)).toHaveLength(0);
  });

  it('refuses a supervisor draft', async () => {
    await expect(
      saveDraft(S, { ticketId: ACTIVE, reviewerId: 'team_lead', responses: { empathy: 'yes' } }),
    ).rejects.toThrow(/resolve the ticket before reviewing it/i);
  });

  it('refuses a supervisor submission', async () => {
    await expect(
      submitReview(S, { ticketId: ACTIVE, reviewerId: 'team_lead', responses: answers() }),
    ).rejects.toThrow(/resolve the ticket before reviewing it/i);
  });

  it('writes nothing at all when it refuses', async () => {
    const before = structuredClone(getStore(S).qualityReviews);
    await expect(runAiReview(S, ACTIVE)).rejects.toThrow();
    await expect(saveDraft(S, { ticketId: ACTIVE, reviewerId: 'team_lead', responses: {} })).rejects.toThrow();
    expect(getStore(S).qualityReviews).toEqual(before);
  });

  it('is not reviewable through the automatic path either', async () => {
    // The hook is a no-op rather than an error, but it must not produce a review
    // for a ticket that never reached an end state.
    startAutomaticAiReview(S, ACTIVE);
    await __settleAiReviewsForTest();
    expect(aiReviews(ACTIVE)).toHaveLength(0);
  });
});

describe('resolving a ticket starts one AI review', () => {
  it('starts exactly one, automatically', async () => {
    await resolveAndSettle();

    const reviews = aiReviews(TICKET);
    expect(reviews).toHaveLength(1);
    expect(reviews[0].ai?.trigger).toBe('automatic');
    expect(reviews[0].ai?.status).toBe('succeeded');
    expect(reviews[0].reviewType).toBe('ai');
    expect(reviews[0].score?.percent).toEqual(expect.any(Number));
  });

  it('does not wait for the AI result before returning', async () => {
    // A provider that answers only when this test says so. If resolution awaited
    // the review, it would hang here instead of returning.
    let release: (result: AiGradeResult) => void = () => {};
    const answer = new Promise<AiGradeResult>((resolve) => { release = resolve; });
    const stalled: AiReviewProvider = { id: 'stalled', grade: () => answer };
    __setAiReviewProviderForTest(stalled);

    const ticket = await resolve();

    // Resolution completed…
    expect(ticket.status).toBe('resolved');
    // …while the review it started is still in flight, recorded as `running` so
    // the workspace has something truthful to show in the meantime.
    const review = latestAiReviewForTicket(getStore(S), TICKET)!;
    expect(review.ai?.status).toBe('running');
    expect(review.score).toBeUndefined();

    release({ status: 'unavailable' });
    await __settleAiReviewsForTest();
    expect(latestAiReviewForTicket(getStore(S), TICKET)?.ai?.status).toBe('failed');
  });

  it('creates no duplicate when the same ticket is resolved again', async () => {
    await resolveAndSettle();
    // A retried request, a repeated status update, a re-save of an already
    // resolved ticket — none of them is a new resolution.
    await resolveAndSettle();
    await resolveAndSettle();

    expect(aiReviews(TICKET)).toHaveLength(1);
  });

  it('creates no duplicate when the automatic trigger fires twice for one resolution', async () => {
    await resolveAndSettle();
    // The guard is the STORE, not the caller: firing the hook directly is
    // exactly what a retry at any layer would do.
    startAutomaticAiReview(S, TICKET);
    startAutomaticAiReview(S, TICKET);
    await __settleAiReviewsForTest();

    expect(aiReviews(TICKET)).toHaveLength(1);
  });

  it('stamps the review with the resolution cycle that started it', async () => {
    await resolveAndSettle();
    // tkt-seed-5 has never been resolved in the seed, so this is its first cycle.
    expect(aiReviews(TICKET)[0].ai?.resolutionCycle).toBe('cycle-1');
  });
});

describe('resolution survives an AI reviewer that cannot run', () => {
  it('resolves normally when the deployment switch is off, and records nothing', async () => {
    delete process.env.HEYQ_AI_REVIEW_ENABLED;

    const ticket = await resolveAndSettle();

    expect(ticket.status).toBe('resolved');
    expect(ticket.resolvedAt).toEqual(expect.any(String));
    // Nothing was asked of the AI, so nothing is claimed about it — a deployment
    // without an AI reviewer must not flag every resolved ticket as unreviewed.
    expect(aiReviews(TICKET)).toHaveLength(0);
  });

  it('resolves normally when an admin has AI reviews turned off', async () => {
    getStore(S).reviewConfig.enabled = false;

    const ticket = await resolveAndSettle();

    expect(ticket.status).toBe('resolved');
    expect(aiReviews(TICKET)).toHaveLength(0);
  });

  it('resolves normally when the provider fails, and says a human is needed', async () => {
    __setAiReviewProviderForTest(unavailableAiProvider);

    const ticket = await resolveAndSettle();

    expect(ticket.status).toBe('resolved');
    const review = aiReviews(TICKET)[0];
    expect(review.ai?.status).toBe('failed');
    expect(review.supervisorReviewRequired).toBe(true);
    expect(review.supervisorReviewReason).toBe('ai_failed');
  });
});

describe('a resolved ticket stays open to review work', () => {
  it('allows a manual AI re-run, replacing the result within the same cycle', async () => {
    await resolveAndSettle();
    const automatic = aiReviews(TICKET)[0];

    __setAiReviewProviderForTest(scriptedAiProvider(answers({ greeting: 'no' })));
    const rerun = await runAiReview(S, TICKET);

    expect(rerun.id).toBe(automatic.id); // one cycle, one record
    expect(rerun.ai?.trigger).toBe('manual');
    expect(rerun.responses.greeting).toBe('no');
    expect(aiReviews(TICKET)).toHaveLength(1);
  });

  it('allows a supervisor review whatever the AI concluded', async () => {
    __setAiReviewProviderForTest(unavailableAiProvider);
    await resolveAndSettle();
    expect(aiReviews(TICKET)[0].ai?.status).toBe('failed');

    const submitted = await submitReview(S, {
      ticketId: TICKET,
      reviewerId: 'team_lead',
      responses: answers(),
    });
    expect(submitted.reviewType).toBe('supervisor');
    expect(submitted.status).toBe('submitted');
    expect(submitted.score?.percent).toBe(100);
  });
});

describe('reopening a ticket', () => {
  it('keeps the previous review history and blocks new review work', async () => {
    await resolveAndSettle();
    const before = structuredClone(aiReviews(TICKET));
    await saveDraft(S, { ticketId: TICKET, reviewerId: 'team_lead', responses: { empathy: 'yes' } });
    const supervisorBefore = structuredClone(getStore(S).qualityReviews.filter((r) => r.reviewType !== 'ai'));

    await reopenTicket(S, TICKET);
    expect(getStore(S).tickets.find((t) => t.id === TICKET)?.status).toBe('in_progress');

    // Everything already recorded is exactly as it was…
    expect(aiReviews(TICKET)).toEqual(before);
    expect(getStore(S).qualityReviews.filter((r) => r.reviewType !== 'ai')).toEqual(supervisorBefore);

    // …and nothing new can be written while the ticket is being worked again.
    await expect(runAiReview(S, TICKET)).rejects.toThrow(/resolve the ticket before reviewing it/i);
    await expect(
      saveDraft(S, { ticketId: TICKET, reviewerId: 'team_lead', responses: { empathy: 'no' } }),
    ).rejects.toThrow(/resolve the ticket before reviewing it/i);
    expect(aiReviews(TICKET)).toEqual(before);
  });

  it('blocks review work when the REQUESTER reopens it by replying', async () => {
    await resolveAndSettle();
    await addRequesterMessage(S, TICKET, 'This is still happening.');

    await expect(runAiReview(S, TICKET)).rejects.toThrow(/resolve the ticket before reviewing it/i);
  });

  it('opens exactly one new review cycle when it is resolved again', async () => {
    await resolveAndSettle();
    const first = aiReviews(TICKET)[0];

    await reopenTicket(S, TICKET);
    await resolveAndSettle();

    const reviews = aiReviews(TICKET);
    expect(reviews).toHaveLength(2);
    // The first cycle's record is untouched — not reset, not rescored, not gone.
    expect(reviews[0]).toEqual(first);
    // The second is its own record, from its own resolution.
    expect(reviews[1].id).not.toBe(first.id);
    expect(reviews[1].ai?.trigger).toBe('automatic');
    expect(reviews[1].ai?.resolutionCycle).not.toBe(first.ai?.resolutionCycle);
    expect(latestAiReviewForTicket(getStore(S), TICKET)?.id).toBe(reviews[1].id);
  });

  it('does not open a further cycle when the re-resolved ticket is resolved again', async () => {
    await resolveAndSettle();
    await reopenTicket(S, TICKET);
    await resolveAndSettle();
    await resolveAndSettle();

    expect(aiReviews(TICKET)).toHaveLength(2);
  });
});

/**
 * The "Tickets to review" queue offers only work a supervisor is actually
 * allowed to do. It is a READ, and it is not the control — the server still
 * refuses an ineligible write (see above), which is what covers a direct link, a
 * stale page, or a ticket reopened under someone who already had it open.
 */
describe('the review queue lists only reviewable tickets', () => {
  const queueIds = async () => (await listReviewable(S)).map((t) => t.ticketId);

  it('excludes tickets that are still being worked', async () => {
    const ids = await queueIds();

    expect(ids).not.toContain('tkt-seed-4'); // in progress
    expect(ids).not.toContain('tkt-seed-5'); // open
    expect(ids).not.toContain('tkt-seed-10'); // on hold
    expect(ids).not.toContain('tkt-seed-7'); // in progress, and carries a draft
    // Every ticket that IS listed is one a review may be written against.
    const store = getStore(S);
    for (const id of ids) {
      const status = store.tickets.find((t) => t.id === id)!.status;
      expect(['resolved', 'closed']).toContain(status);
    }
  });

  it('lists resolved and closed tickets alike', async () => {
    const ids = await queueIds();

    expect(ids).toContain('tkt-seed-15'); // resolved
    expect(ids).toContain('tkt-seed-16'); // closed
  });

  it('adds a ticket the moment it is resolved', async () => {
    expect(await queueIds()).not.toContain(TICKET);
    await resolveAndSettle();
    expect(await queueIds()).toContain(TICKET);
  });

  it('scopes to one agent without letting an active ticket back in', async () => {
    const forAgent = await listReviewable(S, 'l1_agent');
    expect(forAgent.every((t) => t.agentId === 'l1_agent')).toBe(true);
    expect(forAgent.map((t) => t.ticketId)).not.toContain('tkt-seed-4');
  });

  it('drops a reopened ticket from the queue while keeping its review history', async () => {
    await resolveAndSettle();
    await saveDraft(S, { ticketId: TICKET, reviewerId: 'team_lead', responses: { empathy: 'yes' } });
    expect(await queueIds()).toContain(TICKET);
    const reviewsBefore = structuredClone(
      getStore(S).qualityReviews.filter((r) => r.ticketId === TICKET),
    );
    expect(reviewsBefore.length).toBe(2); // the automatic AI review + the draft

    await reopenTicket(S, TICKET);

    // Off the queue — there is no review work to offer while it is active…
    expect(await queueIds()).not.toContain(TICKET);
    // …but nothing was removed: every review it had is still stored, still
    // listed, and still returned by the workspace.
    expect(getStore(S).qualityReviews.filter((r) => r.ticketId === TICKET)).toEqual(reviewsBefore);
    expect((await listReviews(S)).filter((r) => r.review.ticketId === TICKET)).toHaveLength(2);

    // Resolving it again puts it back.
    await resolveAndSettle();
    expect(await queueIds()).toContain(TICKET);
  });
});

/**
 * AI reviews written before resolution cycles existed.
 *
 * A record with no `resolutionCycle` is HISTORY: it describes some earlier
 * resolution nobody tagged. Treating it as part of whatever cycle happens to be
 * current would let a later run reset its score, its findings and its
 * supervisor-required conclusion in place — silently rewriting the past. So it
 * is never reused, never relabelled, and never deleted; a run appends beside it.
 */
describe('a legacy AI review is never reused', () => {
  /** Strip the cycle tag, leaving the record shaped as it was before cycles. */
  function makeLegacy(ticketId: string): QualityReview {
    const review = getStore(S).qualityReviews.find(
      (r) => r.ticketId === ticketId && r.reviewType === 'ai',
    )!;
    delete review.ai!.resolutionCycle;
    delete review.ai!.trigger;
    return structuredClone(review);
  }

  it('appends a new tagged record on a re-run instead of overwriting it', async () => {
    await resolveAndSettle();
    const legacy = makeLegacy(TICKET);

    __setAiReviewProviderForTest(scriptedAiProvider(answers({ greeting: 'no' })));
    const rerun = await runAiReview(S, TICKET);

    expect(rerun.id).not.toBe(legacy.id);
    expect(rerun.ai?.resolutionCycle).toBe('cycle-1');
    expect(rerun.ai?.trigger).toBe('manual');
    // The legacy record is byte-for-byte what it was — score, findings and
    // conclusion intact, and still untagged.
    expect(aiReviews(TICKET).find((r) => r.id === legacy.id)).toEqual(legacy);
    expect(aiReviews(TICKET)).toHaveLength(2);
  });

  it('appends rather than overwriting when a later resolution cycle grades the ticket', async () => {
    await resolveAndSettle();
    const legacy = makeLegacy(TICKET);

    await reopenTicket(S, TICKET);
    await resolveAndSettle();

    expect(aiReviews(TICKET).find((r) => r.id === legacy.id)).toEqual(legacy);
    expect(latestAiReviewForTicket(getStore(S), TICKET)?.ai?.resolutionCycle).toBe('cycle-2');
    expect(aiReviews(TICKET)).toHaveLength(2);
  });

  it('does not count as this cycle\'s automatic review', async () => {
    await resolveAndSettle();
    makeLegacy(TICKET);

    // The duplicate guard looks for an AUTOMATIC record tagged with this cycle.
    // An untagged one is not that, so the ticket is treated as ungraded for the
    // current cycle rather than skipped on the strength of a historical record.
    startAutomaticAiReview(S, TICKET);
    await __settleAiReviewsForTest();

    const reviews = aiReviews(TICKET);
    expect(reviews).toHaveLength(2);
    expect(reviews[1].ai?.resolutionCycle).toBe('cycle-1');
    expect(reviews[1].ai?.trigger).toBe('automatic');
  });

  it('still coalesces runs that DO belong to the same cycle', async () => {
    await resolveAndSettle();
    makeLegacy(TICKET);

    // First run after the legacy record appends…
    const first = await runAiReview(S, TICKET);
    // …and every later run in the same cycle updates that record in place, so
    // the append rule does not become "a new record every time".
    const second = await runAiReview(S, TICKET);
    const third = await runAiReview(S, TICKET);

    expect(second.id).toBe(first.id);
    expect(third.id).toBe(first.id);
    expect(second.ai?.resolutionCycle).toBe('cycle-1');
    // One legacy record and one for the current cycle — never a record per run.
    expect(aiReviews(TICKET)).toHaveLength(2);
  });
});
