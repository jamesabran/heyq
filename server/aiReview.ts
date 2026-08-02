/**
 * aiReview — orchestration for AI quality reviews.
 *
 * Sits between the pure prompt/parser (aiReviewPrompt.ts), the provider boundary
 * (aiReviewProvider.ts), and the store. It owns exactly one decision the other
 * modules must not make: whether a human still has to look at this ticket.
 *
 * Five rules hold everywhere in this file:
 *
 *   1. The MANUAL path is never touched. `upsertDraft` / `submitReview` in
 *      server/reviews.ts are not called, and no supervisor record is read for
 *      writing or written to. An AI review is its own record, always.
 *
 *   2. Scoring is not reimplemented. `computeReviewScore` scores an AI review
 *      exactly as it scores a supervisor's, so the two numbers mean the same
 *      thing and a rubric change moves both together.
 *
 *   3. Failure is contained. A provider that is down, refuses, returns nonsense,
 *      or throws produces a FAILED review record that requires supervisor review
 *      — never an exception that could reach a ticket operation. The only errors
 *      thrown from here are caller errors (AI disabled, unknown ticket), raised
 *      before any AI work begins.
 *
 *   4. Only FINISHED handling is graded. Every entry point checks
 *      `isReviewEligible` before doing anything, so an active ticket cannot be
 *      reviewed through the UI, through the API, or by accident.
 *
 *   5. History is append-only. A run belongs to a RESOLUTION CYCLE; a run in a
 *      new cycle appends a new record rather than rewriting the previous one, so
 *      reopening and re-resolving a ticket can never erase what the AI said the
 *      first time round.
 */
import { QUALITY_RUBRIC } from '../src/app/data/reviewRubric.ts';
import { isReviewEligible, REVIEW_BLOCKED_MESSAGE } from '../src/app/services/reviewEligibility.ts';
import { computeReviewScore } from '../src/app/services/reviewScoring.ts';
import type {
  AiFinding,
  AiReviewConfig,
  AiReviewError,
  AiReviewTrigger,
  QualityReview,
  ReviewScore,
  SupervisorRequiredReason,
} from '../src/app/models/review.ts';
import type { Ticket, TicketStatus } from '../src/app/models/ticket.ts';
import { clone, makeId, nowIso } from '../src/app/lib/mock.ts';
import { buildReviewPrompt, findingsToResponses, parseAiReview } from './aiReviewPrompt.ts';
import { getAiReviewProvider } from './aiReviewProvider.ts';
import { aiReviewsForTicket, latestAiReviewForTicket } from './reviews.ts';
import { getStore, type Store } from './store.ts';
import { getTicketDetail, onTicketResolved } from './tickets.ts';

/** Server-owned config for this store. Read fresh on every run, never cached. */
export function getReviewConfig(storeId: string): AiReviewConfig {
  return getStore(storeId).reviewConfig;
}

/**
 * The deployment-level off switch for AI Quality Reviews (`HEYQ_AI_REVIEW_ENABLED`).
 *
 * Defaults to DISABLED and only `true` turns it on: an unset, empty, or
 * misspelled value fails CLOSED. Grading a ticket spends real inference and
 * writes an opinion about a named agent's work, so that has to be something a
 * deployment opts into rather than something it forgets to switch off.
 *
 * This is separate from the per-store `reviewConfig.enabled`, which is a product
 * setting a store can hold; this is the operator's switch and outranks it. Read
 * fresh on every run so flipping it takes effect without a restart.
 */
export function aiReviewsEnabled(): boolean {
  return process.env.HEYQ_AI_REVIEW_ENABLED?.trim().toLowerCase() === 'true';
}

/**
 * Whether a supervisor must still review this ticket, and why.
 *
 * Zero tolerance outranks a low score: a compliance finding is the more serious
 * of the two and is the more useful reason to show. A percentage EXACTLY equal to
 * the threshold is not below it, so equality does not require review.
 */
export function decideSupervisorRequired(
  score: ReviewScore,
  thresholdPercent: number,
): { required: boolean; reason?: SupervisorRequiredReason } {
  if (score.zeroToleranceFailures.length > 0) return { required: true, reason: 'zero_tolerance' };
  // Nothing scorable came back — there is no number to compare, so a human must look.
  if (score.percent === null) return { required: true, reason: 'unscorable' };
  if (score.percent < thresholdPercent) return { required: true, reason: 'low_score' };
  return { required: false };
}

/**
 * Which resolution cycle a ticket is currently in: how many times it has crossed
 * from ACTIVE work into an end state.
 *
 * Counted from the status history rather than stored, so it needs no new ticket
 * state and cannot drift from what actually happened. Two properties matter:
 *
 *   - Re-resolving an already-resolved ticket does not advance it. That
 *     transition starts from an end state, so it is not a new resolution — which
 *     is what makes a retry or a repeated status update harmless.
 *   - Reopening and resolving again DOES advance it, however quickly. A
 *     timestamp would not: two resolutions in the same millisecond would share a
 *     key and the second would overwrite the first cycle's review.
 *
 * A ticket that reached an end state without ever recording the transition (the
 * seed sets some statuses directly) sits in cycle 0 — one stable bucket, so
 * re-runs on it coalesce instead of piling up.
 */
function resolutionCycleOf(store: Store, ticket: Ticket): string {
  const endStates: TicketStatus[] = ['resolved', 'closed'];
  const resolutions = store.statusEvents.filter(
    (e) =>
      e.ticketId === ticket.id &&
      endStates.includes(e.toStatus) &&
      !(e.fromStatus && endStates.includes(e.fromStatus)),
  );
  return `cycle-${resolutions.length}`;
}

/**
 * Whether an AUTOMATIC review has already been started for the ticket's current
 * resolution cycle — the duplicate guard the whole automatic path rests on.
 *
 * It reads the STORE, not a timer or a lock, and the record it looks for is
 * written synchronously before any provider work begins. A retried request, a
 * repeated resolved update, or a second save of an already-resolved ticket
 * therefore all find the first run's record and stop.
 */
function hasAutomaticReviewForCycle(store: Store, ticket: Ticket): boolean {
  const cycle = resolutionCycleOf(store, ticket);
  return aiReviewsForTicket(store, ticket.id).some(
    (r) => r.ai?.trigger === 'automatic' && r.ai?.resolutionCycle === cycle,
  );
}

/**
 * Open a run: reuse the ticket's AI review only when it EXPLICITLY belongs to the
 * current resolution cycle, otherwise append a new record.
 *
 * Reusing within a cycle keeps a re-run from growing a pile of stale opinions
 * about one resolution. Appending otherwise is the rule that matters, and it has
 * two cases:
 *
 *   - A record from an EARLIER cycle. The ticket was reopened and resolved
 *     again; what the AI said the first time round stays exactly where it was.
 *   - A record with NO `resolutionCycle` at all — written before cycles existed.
 *     It is history, and history has no current cycle to belong to. Adopting it
 *     into whatever cycle happens to be current would silently overwrite an old
 *     assessment of an old resolution and relabel it as a new one, which is the
 *     precise thing this feature promises never to do. So it is left alone, and
 *     the run appends a properly tagged record beside it.
 *
 * That is deliberately unlike the `reviewType` / `trigger` defaults: those infer
 * a value that was always true of the record. A cycle is not a property the
 * record ever had, so there is nothing to infer.
 */
function beginRun(store: Store, ticket: Ticket, config: AiReviewConfig, trigger: AiReviewTrigger): QualityReview {
  const now = nowIso();
  const cycle = resolutionCycleOf(store, ticket);
  const meta = {
    provider: getAiReviewProvider().id,
    model: config.model,
    promptVersion: config.promptVersion,
    trigger,
    resolutionCycle: cycle,
    status: 'running' as const,
    requestedAt: now,
  };

  const existing = latestAiReviewForTicket(store, ticket.id);
  if (existing?.ai?.resolutionCycle === cycle) {
    existing.ai = meta;
    existing.status = 'draft';
    existing.responses = {};
    existing.score = undefined;
    existing.submittedAt = undefined;
    existing.supervisorReviewRequired = undefined;
    existing.supervisorReviewReason = undefined;
    existing.thresholdPercent = undefined;
    existing.updatedAt = now;
    return existing;
  }

  const review: QualityReview = {
    id: makeId('qrai'),
    ticketId: ticket.id,
    agentId: ticket.assigneeId!,
    // An AI review has no human owner; the UI reads authorship from `reviewType`.
    reviewerId: 'ai',
    reviewType: 'ai',
    status: 'draft',
    rubricVersion: QUALITY_RUBRIC.version,
    responses: {},
    feedback: { whatWentWell: '', areasForImprovement: '', reviewerComments: '' },
    ai: meta,
    createdAt: now,
    updatedAt: now,
  };
  store.qualityReviews.push(review);
  return review;
}

/**
 * Roll the AI reviewer's health forward. Called after EVERY attempt, success or
 * failure, so "one blip" is distinguishable from "consistently broken". A single
 * success resets the streak — the counter measures the current run of failures,
 * not a lifetime total.
 */
function recordHealth(store: Store, outcome: { ok: true } | { ok: false; code: string }): void {
  const now = nowIso();
  const health = store.aiHealth;
  if (outcome.ok) {
    health.consecutiveFailures = 0;
    health.lastSuccessAt = now;
    return;
  }
  health.consecutiveFailures += 1;
  health.lastErrorCode = outcome.code;
  health.lastErrorAt = now;
}

/**
 * Record a failed run. Always requires supervisor review — failing safe toward a
 * human.
 *
 * `countAgainstHealth` exists for the one failure that is not the reviewer's
 * fault: being switched off is a deliberate operator decision, and counting it
 * as a failure streak would report a perfectly healthy model as broken.
 */
function finishFailed(
  store: Store,
  review: QualityReview,
  error: AiReviewError,
  latencyMs?: number,
  { countAgainstHealth = true }: { countAgainstHealth?: boolean } = {},
): QualityReview {
  const now = nowIso();
  review.ai = {
    ...review.ai!,
    status: 'failed',
    completedAt: now,
    error,
    ...(latencyMs !== undefined ? { latencyMs } : {}),
  };
  review.status = 'draft'; // nothing was assessed, so nothing is complete
  review.supervisorReviewRequired = true;
  review.supervisorReviewReason = 'ai_failed';
  review.updatedAt = now;
  if (countAgainstHealth) recordHealth(store, { ok: false, code: error.code });
  return review;
}

function finishSucceeded(
  store: Store,
  review: QualityReview,
  findings: Record<string, AiFinding>,
  config: AiReviewConfig,
  transport: { latencyMs?: number; modelVersion?: string } = {},
): QualityReview {
  const now = nowIso();
  const responses = findingsToResponses(findings);
  const score = computeReviewScore(responses);
  const { required, reason } = decideSupervisorRequired(score, config.thresholdPercent);

  review.ai = {
    ...review.ai!,
    status: 'succeeded',
    completedAt: now,
    findings,
    ...(transport.latencyMs !== undefined ? { latencyMs: transport.latencyMs } : {}),
    // Only ever set when the host actually reported one.
    ...(transport.modelVersion ? { modelVersion: transport.modelVersion } : {}),
  };
  review.responses = responses;
  review.score = score;
  review.status = 'submitted';
  review.submittedAt = now;
  // Frozen alongside rubricVersion: a later threshold change must never rewrite
  // the conclusion a completed review was recorded with.
  review.rubricVersion = QUALITY_RUBRIC.version;
  review.thresholdPercent = config.thresholdPercent;
  review.supervisorReviewRequired = required;
  review.supervisorReviewReason = reason;
  review.updatedAt = now;
  recordHealth(store, { ok: true });
  return review;
}

/**
 * The checks every run shares, in the order a caller cares about. Throws on a
 * caller error BEFORE any record is created, so a refused request never leaves a
 * half-built review behind.
 */
function requireRunnableTicket(store: Store, ticketId: string): Ticket & { assigneeId: string } {
  const ticket = store.tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  if (!ticket.assigneeId) throw new Error('This ticket has no assigned agent to review.');
  // The rule this whole feature turns on: an active ticket is still being
  // handled, so there is no finished handling to grade yet.
  if (!isReviewEligible(ticket)) throw new Error(REVIEW_BLOCKED_MESSAGE);
  return ticket as Ticket & { assigneeId: string };
}

/**
 * Grade an already-opened run to completion.
 *
 * Everything here is CONTAINED: no provider or parser outcome may throw out of
 * this function, because one of its callers is a background task nobody is
 * awaiting and the other sits next to a ticket operation.
 */
async function completeRun(
  storeId: string,
  store: Store,
  review: QualityReview,
  ticket: Ticket & { assigneeId: string },
  config: AiReviewConfig,
): Promise<QualityReview> {
  // Switched off for this deployment. Nothing is selected, no prompt is built,
  // and no provider is asked for anything — the run stops here.
  //
  // It still produces the ordinary FAILED record rather than throwing, because
  // "the AI did not assess this" is exactly what every other failure means to a
  // caller: the workspace renders it, and the ticket still goes to a human. A
  // throw would instead surface as a broken request for a deliberate setting.
  if (!aiReviewsEnabled()) {
    return finishFailed(
      store,
      review,
      { code: 'disabled', message: 'AI Quality Reviews are switched off for this deployment.' },
      undefined,
      // Not the reviewer's fault, so it must not show up as a failure streak.
      { countAgainstHealth: false },
    );
  }

  try {
    const evidence = await getTicketDetail(storeId, ticket.id);
    if (!evidence) {
      return finishFailed(store, review, { code: 'evidence_missing', message: 'The ticket evidence could not be read.' });
    }

    const prompt = buildReviewPrompt(evidence, {
      rubric: QUALITY_RUBRIC,
      promptVersion: config.promptVersion,
      agentName: evidence.assigneeName ?? ticket.assigneeId,
    });

    const result = await getAiReviewProvider().grade({ prompt, model: config.model });

    if (result.status === 'unavailable') {
      // A real transport says WHY it could not be reached; the fake does not.
      return finishFailed(
        store,
        review,
        { code: result.code ?? 'unavailable', message: result.message ?? 'The AI reviewer is unavailable.' },
        result.latencyMs,
      );
    }
    if (result.status === 'error') {
      return finishFailed(store, review, { code: result.code, message: result.message }, result.latencyMs);
    }

    const parsed = parseAiReview(result.raw, QUALITY_RUBRIC);
    if (!parsed.ok) {
      // The call succeeded but the content is unusable — still a failed run, and
      // still counted against health: a model that reliably returns garbage is
      // just as broken as one that is down.
      return finishFailed(store, review, { code: parsed.code, message: parsed.message }, result.latencyMs);
    }

    return finishSucceeded(store, review, parsed.findings, config, {
      latencyMs: result.latencyMs,
      modelVersion: result.modelVersion,
    });
  } catch (err) {
    // A provider that breaks its contract and throws is still contained here.
    return finishFailed(store, review, {
      code: 'provider_threw',
      message: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Run an AI review for one ticket ON REQUEST, and return the resulting record.
 *
 * This is the MANUAL path — the supervisor's "Re-run AI review" fallback. It is
 * awaited, because someone is watching a button and is owed an answer; the
 * provider bounds its own timeout and retries at most once, so the request has a
 * known ceiling. The ticket must already be in an end state: a re-run of an
 * active ticket is refused here, not merely hidden in the UI.
 */
export async function runAiReview(storeId: string, ticketId: string): Promise<QualityReview> {
  const store = getStore(storeId);
  const config = store.reviewConfig;

  if (!config.enabled) {
    throw new Error('AI Quality Reviews are disabled.');
  }
  const ticket = requireRunnableTicket(store, ticketId);

  const review = beginRun(store, ticket, config, 'manual');
  return clone(await completeRun(storeId, store, review, ticket, config));
}

// ── The automatic review, started when a ticket is resolved ──────────────────

/**
 * Runs started by a resolution and not yet finished. Tracked ONLY so tests can
 * wait for them deterministically — nothing in production reads this, and it is
 * emptied as each run settles rather than accumulating.
 */
const inFlight = new Set<Promise<unknown>>();

/**
 * Resolve once every automatic review started so far has settled. A TEST
 * affordance, in the spirit of `__setAiReviewProviderForTest`: the product path
 * deliberately never waits, so a test that needs the finished record has to say
 * so explicitly.
 */
export async function __settleAiReviewsForTest(): Promise<void> {
  while (inFlight.size > 0) {
    await Promise.allSettled([...inFlight]);
  }
}

/**
 * Start the ONE automatic AI review for a ticket that has just been resolved.
 *
 * Returns immediately — synchronously, before any provider work. The record is
 * created in the store first (status `running`) and the grading is then left to
 * run on its own, so the resolution request that triggered this completes at its
 * own speed no matter how slow the model is. A supervisor opening the workspace
 * mid-run sees the running record; when it settles, the same record carries the
 * result.
 *
 * Every reason not to run is a SILENT no-op, never an error: resolving a ticket
 * must not fail because the reviewer is switched off, the ticket has no assignee,
 * or a review was already started for this resolution.
 */
export function startAutomaticAiReview(storeId: string, ticketId: string): void {
  const store = getStore(storeId);
  const config = store.reviewConfig;
  // Switched off — as a product setting for this store, or for the deployment.
  // Nothing is recorded AT ALL, unlike the manual path: nobody asked for this
  // run, so there is nobody to hand a failed record to. Writing one anyway would
  // stamp "the AI could not review this" onto every resolved ticket in a
  // deployment that deliberately has no AI reviewer.
  if (!config.enabled || !aiReviewsEnabled()) return;

  const ticket = store.tickets.find((t) => t.id === ticketId);
  if (!ticket?.assigneeId) return;
  if (!isReviewEligible(ticket)) return;
  // One automatic review per resolution cycle — the duplicate guard.
  if (hasAutomaticReviewForCycle(store, ticket)) return;

  const runnable = ticket as Ticket & { assigneeId: string };
  // Written BEFORE the await: any second call in this same cycle now finds it.
  const review = beginRun(store, runnable, config, 'automatic');

  // `completeRun` contains its own failures, so this only catches the truly
  // unexpected. It must still never reject: nobody is awaiting this promise.
  const run = completeRun(storeId, store, review, runnable, config).catch(() => undefined);
  inFlight.add(run);
  void run.finally(() => inFlight.delete(run));
}

/**
 * Wire the automatic review to ticket resolution.
 *
 * Registered here rather than imported by server/tickets.ts, so tickets keep
 * knowing nothing about AI reviews — the same inversion server/store.ts uses for
 * its reset hooks. server/http.ts imports this module, so the wiring is in place
 * for the running server and for every test (src/test/setup.ts builds the HTTP
 * server for the whole suite).
 */
onTicketResolved(startAutomaticAiReview);
