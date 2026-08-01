/**
 * aiReviewPrompt — PURE prompt construction and response parsing for AI quality
 * reviews. No I/O, no store access, no provider, no scoring.
 *
 * This module is deliberately the only place that knows the SHAPE of an AI
 * exchange, and it is pure so every malformed-output path can be tested cheaply
 * and exhaustively. Two halves:
 *
 *   buildReviewPrompt() — turns ticket evidence + the current rubric into a
 *     structured request. Versioned by `promptVersion` independently of the
 *     rubric, so the prompt can be revised without disturbing frozen scores.
 *
 *   parseAiReview()     — turns a provider's raw text into strict findings, or a
 *     typed refusal. It is deliberately UNFORGIVING: a review that a supervisor
 *     may act on must never be assembled from a half-understood response.
 *
 * It NEVER computes a score. `computeReviewScore` in
 * src/app/services/reviewScoring.ts stays the single scoring implementation, so
 * an AI review and a supervisor review are scored by identical code.
 */
import { allCriteria } from '../src/app/data/reviewRubric.ts';
import type { AiFinding, CriterionValue, Rubric } from '../src/app/models/review.ts';
import type { TicketDetailView } from '../src/app/models/ticket.ts';
import { CONCERN_TYPE_LABELS, STATUS_LABELS } from '../src/app/models/ticket.ts';

/**
 * Answers an AI may give in this phase. `na` is deliberately EXCLUDED: N/A drops
 * a criterion out of the possible score entirely (scoring rule 2), so a model
 * free to answer N/A could inflate its own percentage by abstaining. Supervisors
 * keep the full three-value vocabulary.
 */
export const AI_ALLOWED_VALUES: CriterionValue[] = ['yes', 'no'];

/** Rationales and evidence are stored, so both are bounded rather than trusted to be short. */
export const MAX_RATIONALE_LENGTH = 240;
export const MAX_EVIDENCE_LENGTH = 240;

// ── Prompt ───────────────────────────────────────────────────────────────────

export interface PromptCriterion {
  id: string;
  label: string;
  hint?: string;
  required: boolean;
  zeroTolerance: boolean;
}

export interface PromptMessage {
  author: 'requester' | 'agent' | 'system';
  body: string;
}

/**
 * A structured review request. Kept as DATA rather than a rendered string so the
 * transport (Phase 2) decides how to serialize it for a specific model, and so
 * tests can assert on content instead of prose.
 */
export interface AiReviewPrompt {
  promptVersion: string;
  rubricVersion: string;
  instructions: string;
  allowedValues: CriterionValue[];
  criteria: PromptCriterion[];
  ticket: {
    reference: string;
    subject: string;
    concern: string;
    status: string;
    agentName: string;
  };
  conversation: PromptMessage[];
}

const INSTRUCTIONS = [
  'You are grading how a support agent handled one customer ticket.',
  'Answer every criterion listed, using only the allowed values.',
  'Answer "yes" only when the standard was clearly met in the conversation.',
  'Give a one-sentence rationale for every answer, citing what the agent did.',
  'Quote a short excerpt from the conversation as evidence for every answer.',
  'Optionally give a confidence between 0 and 1 for each answer.',
  'Reply with JSON only, shaped as {"findings":{"<criterionId>":' +
    '{"value":"yes|no","rationale":"...","evidence":"...","confidence":0.0}}}.',
].join(' ');

/**
 * Build the review request for one ticket. Takes the SAME evidence object the
 * review workspace renders (`getTicketDetail`), so the model grades exactly what
 * a supervisor would read — internal notes excluded, as they are not part of how
 * the customer was handled.
 */
export function buildReviewPrompt(
  evidence: TicketDetailView,
  options: { rubric: Rubric; promptVersion: string; agentName: string },
): AiReviewPrompt {
  const { rubric, promptVersion, agentName } = options;
  const { ticket } = evidence;

  return {
    promptVersion,
    rubricVersion: rubric.version,
    instructions: INSTRUCTIONS,
    allowedValues: [...AI_ALLOWED_VALUES],
    criteria: allCriteria(rubric).map((c) => ({
      id: c.id,
      label: c.label,
      hint: c.hint,
      required: Boolean(c.required),
      zeroTolerance: Boolean(c.zeroTolerance),
    })),
    ticket: {
      reference: ticket.reference,
      subject: ticket.subject,
      concern: ticket.concernType ? CONCERN_TYPE_LABELS[ticket.concernType] : 'Unset',
      status: STATUS_LABELS[ticket.status],
      agentName,
    },
    conversation: evidence.messages.map((m) => ({ author: m.authorType, body: m.body })),
  };
}

// ── Parser ───────────────────────────────────────────────────────────────────

export type AiParseErrorCode =
  | 'invalid_json'
  | 'malformed_shape'
  | 'unknown_criterion'
  | 'missing_criterion'
  | 'unsupported_value'
  | 'missing_rationale'
  | 'missing_evidence'
  | 'invalid_confidence';

export type ParsedAiReview =
  | { ok: true; findings: Record<string, AiFinding> }
  | { ok: false; code: AiParseErrorCode; message: string };

const fail = (code: AiParseErrorCode, message: string): ParsedAiReview => ({ ok: false, code, message });

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Parse a provider response into findings, or refuse with a typed reason.
 *
 * Refuses when the response is not JSON, is not the expected shape, names a
 * criterion the rubric does not have, omits ANY rubric criterion, uses a value
 * outside the allowed set (including `na`), or gives an answer with no rationale.
 *
 * Requiring EVERY criterion — not only the `required` ones — is deliberate: a
 * partial answer set would still produce a valid-looking percentage, computed
 * over whichever subset the model happened to return. A score whose denominator
 * depends on the model's diligence is worse than no score at all.
 */
export function parseAiReview(raw: string, rubric: Rubric): ParsedAiReview {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.trim());
  } catch {
    return fail('invalid_json', 'The AI reviewer did not return valid JSON.');
  }

  if (!isRecord(parsed) || !isRecord(parsed.findings)) {
    return fail('malformed_shape', 'The AI response has no `findings` object.');
  }
  const rawFindings = parsed.findings;

  const criteria = allCriteria(rubric);
  const knownIds = new Set(criteria.map((c) => c.id));

  for (const id of Object.keys(rawFindings)) {
    if (!knownIds.has(id)) {
      return fail('unknown_criterion', `The AI answered a criterion that is not in the rubric: "${id}".`);
    }
  }

  const findings: Record<string, AiFinding> = {};
  for (const criterion of criteria) {
    const entry = rawFindings[criterion.id];
    if (entry === undefined) {
      return fail('missing_criterion', `The AI did not answer "${criterion.id}".`);
    }
    if (!isRecord(entry)) {
      return fail('malformed_shape', `The answer for "${criterion.id}" is not an object.`);
    }

    const { value, rationale, evidence, confidence } = entry;
    if (typeof value !== 'string' || !(AI_ALLOWED_VALUES as string[]).includes(value)) {
      return fail(
        'unsupported_value',
        `"${criterion.id}" was answered "${String(value)}" — only ${AI_ALLOWED_VALUES.join(' or ')} are accepted.`,
      );
    }
    if (typeof rationale !== 'string' || rationale.trim() === '') {
      return fail('missing_rationale', `The AI gave no rationale for "${criterion.id}".`);
    }
    // Evidence is required: an answer a supervisor cannot trace back to what was
    // actually said in the conversation is not one they can check.
    if (typeof evidence !== 'string' || evidence.trim() === '') {
      return fail('missing_evidence', `The AI cited no evidence for "${criterion.id}".`);
    }
    // Confidence is optional, but a present value must be a real 0–1 number
    // rather than a string, a percentage, or NaN.
    if (confidence !== undefined) {
      if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        return fail(
          'invalid_confidence',
          `"${criterion.id}" reported a confidence of ${String(confidence)} — expected a number between 0 and 1.`,
        );
      }
    }

    findings[criterion.id] = {
      value: value as CriterionValue,
      rationale: rationale.trim().slice(0, MAX_RATIONALE_LENGTH),
      evidence: evidence.trim().slice(0, MAX_EVIDENCE_LENGTH),
      ...(confidence !== undefined ? { confidence } : {}),
    };
  }

  return { ok: true, findings };
}

/** The answer map `computeReviewScore` expects, derived from parsed findings. */
export function findingsToResponses(findings: Record<string, AiFinding>): Record<string, CriterionValue> {
  return Object.fromEntries(Object.entries(findings).map(([id, f]) => [id, f.value]));
}
