/**
 * aiReview — orchestration for AI quality reviews.
 *
 * Sits between the pure prompt/parser (aiReviewPrompt.ts), the provider boundary
 * (aiReviewProvider.ts), and the store. It owns exactly one decision the other
 * modules must not make: whether a human still has to look at this ticket.
 *
 * Three rules hold everywhere in this file:
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
 */
import { QUALITY_RUBRIC } from '../src/app/data/reviewRubric.ts';
import { computeReviewScore } from '../src/app/services/reviewScoring.ts';
import type {
  AiFinding,
  AiReviewConfig,
  AiReviewError,
  QualityReview,
  ReviewScore,
  SupervisorRequiredReason,
} from '../src/app/models/review.ts';
import { clone, makeId, nowIso } from '../src/app/lib/mock.ts';
import { buildReviewPrompt, findingsToResponses, parseAiReview } from './aiReviewPrompt.ts';
import { getAiReviewProvider } from './aiReviewProvider.ts';
import { latestAiReviewForTicket } from './reviews.ts';
import { getStore, type Store } from './store.ts';
import { getTicketDetail } from './tickets.ts';

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

/** Create the ticket's AI review, or reset the existing one for a rerun. */
function startRun(store: Store, ticketId: string, agentId: string, config: AiReviewConfig): QualityReview {
  const now = nowIso();
  const meta = {
    provider: getAiReviewProvider().id,
    model: config.model,
    promptVersion: config.promptVersion,
    status: 'running' as const,
    requestedAt: now,
  };

  // A rerun REPLACES the ticket's AI review in place rather than accumulating
  // records, so `latestAiReviewForTicket` stays unambiguous and a demo cannot
  // silently grow a pile of stale AI opinions about one ticket.
  const existing = latestAiReviewForTicket(store, ticketId);
  if (existing) {
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
    ticketId,
    agentId,
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
 * Run an AI review for one ticket and return the resulting record.
 *
 * Still synchronous and still explicitly triggered: the provider bounds its own
 * timeout and retries at most once, so the request has a known ceiling. Moving
 * to a background job changes the caller, not the stored shape — the record
 * already carries a `running` status and a latency.
 */
export async function runAiReview(storeId: string, ticketId: string): Promise<QualityReview> {
  const store = getStore(storeId);
  const config = store.reviewConfig;

  // Caller errors — raised BEFORE any record is created, so a refused request
  // never leaves a half-built review behind.
  if (!config.enabled) {
    throw new Error('AI Quality Reviews are disabled.');
  }
  const ticket = store.tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  if (!ticket.assigneeId) throw new Error('This ticket has no assigned agent to review.');

  const evidence = await getTicketDetail(storeId, ticketId);
  if (!evidence) throw new Error('Ticket not found');

  const review = startRun(store, ticketId, ticket.assigneeId, config);

  // Switched off for this deployment. Nothing is selected, no prompt is built,
  // and no provider is asked for anything — the run stops here.
  //
  // It still produces the ordinary FAILED record rather than throwing, because
  // "the AI did not assess this" is exactly what every other failure means to a
  // caller: the workspace renders it, and the ticket still goes to a human. A
  // throw would instead surface as a broken request for a deliberate setting.
  if (!aiReviewsEnabled()) {
    return clone(
      finishFailed(
        store,
        review,
        { code: 'disabled', message: 'AI Quality Reviews are switched off for this deployment.' },
        undefined,
        // Not the reviewer's fault, so it must not show up as a failure streak.
        { countAgainstHealth: false },
      ),
    );
  }

  // Everything from here is contained: no provider or parser outcome may throw
  // out of this function, because callers include ticket-adjacent flows.
  try {
    const prompt = buildReviewPrompt(evidence, {
      rubric: QUALITY_RUBRIC,
      promptVersion: config.promptVersion,
      agentName: evidence.assigneeName ?? ticket.assigneeId,
    });

    const result = await getAiReviewProvider().grade({ prompt, model: config.model });

    if (result.status === 'unavailable') {
      // A real transport says WHY it could not be reached; the fake does not.
      return clone(
        finishFailed(
          store,
          review,
          { code: result.code ?? 'unavailable', message: result.message ?? 'The AI reviewer is unavailable.' },
          result.latencyMs,
        ),
      );
    }
    if (result.status === 'error') {
      return clone(
        finishFailed(store, review, { code: result.code, message: result.message }, result.latencyMs),
      );
    }

    const parsed = parseAiReview(result.raw, QUALITY_RUBRIC);
    if (!parsed.ok) {
      // The call succeeded but the content is unusable — still a failed run, and
      // still counted against health: a model that reliably returns garbage is
      // just as broken as one that is down.
      return clone(
        finishFailed(store, review, { code: parsed.code, message: parsed.message }, result.latencyMs),
      );
    }

    return clone(
      finishSucceeded(store, review, parsed.findings, config, {
        latencyMs: result.latencyMs,
        modelVersion: result.modelVersion,
      }),
    );
  } catch (err) {
    // A provider that breaks its contract and throws is still contained here.
    return clone(
      finishFailed(store, review, {
        code: 'provider_threw',
        message: err instanceof Error ? err.message : String(err),
      }),
    );
  }
}
