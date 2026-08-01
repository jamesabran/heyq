/**
 * aiReviewProvider — the AI grading boundary, modelled on server/orderProvider.ts.
 *
 * This is the ONLY module that will know a model host exists. It returns a result
 * UNION rather than throwing, exactly like the order provider's
 * ok/forbidden/not_found/unavailable results, so a model being down is ordinary
 * control flow rather than an exception that could escape into a ticket
 * operation.
 *
 * Phase 1 ships a deterministic FAKE transport: no network call is made from
 * anywhere in this file, and none may be added — Hugging Face/Gemma arrives in
 * Phase 2 by implementing `AiReviewProvider` against a real fetch and swapping
 * the default. Orchestration, parsing, scoring, and UI stay untouched by that
 * swap, which is the whole point of this seam.
 */
import { allCriteria, QUALITY_RUBRIC } from '../src/app/data/reviewRubric.ts';
import type { CriterionValue } from '../src/app/models/review.ts';
import type { AiReviewPrompt } from './aiReviewPrompt.ts';

export interface AiReviewRequest {
  prompt: AiReviewPrompt;
  model: string;
}

/**
 * `raw` is the model's unparsed text — deliberately NOT pre-parsed here, so the
 * strict parser in aiReviewPrompt.ts sees exactly what a real model returned.
 */
export type AiGradeResult =
  | { status: 'ok'; raw: string; latencyMs: number }
  | { status: 'unavailable' }
  | { status: 'error'; code: string; message: string };

export interface AiReviewProvider {
  /** Stable identifier stored on every review this provider produces. */
  id: string;
  grade(request: AiReviewRequest): Promise<AiGradeResult>;
}

interface FakeFinding {
  value: CriterionValue;
  rationale: string;
  evidence: string;
  confidence?: number;
}

/** Serialize findings the way a well-behaved model would answer the prompt. */
function toRawResponse(answers: Record<string, FakeFinding>): string {
  return JSON.stringify({ findings: answers });
}

/** Truncate a transcript line to a quotable excerpt. */
const excerpt = (body: string, max = 120): string => {
  const clean = body.replace(/\s+/g, ' ').trim();
  return clean.length > max ? `${clean.slice(0, max).trimEnd()}…` : clean;
};

/**
 * Deterministic stand-in grader. Answers every rubric criterion, deriving the
 * handful of "no" answers from a stable hash of the ticket reference so a given
 * ticket always grades identically — reruns must not produce a moving score.
 *
 * Zero-tolerance criteria are never failed by the fake: a simulated compliance
 * accusation against a named agent would be indefensible in a demo, and tests
 * that need that path inject `scriptedAiProvider` instead.
 */
export const fakeAiProvider: AiReviewProvider = {
  id: 'fake',
  async grade({ prompt }) {
    const answers: Record<string, FakeFinding> = {};
    // Evidence is quoted from the REAL transcript the prompt carries, so the
    // demo shows a supervisor exactly what it would show against a real model:
    // an answer they can trace back to something that was actually said.
    const lines = prompt.conversation.filter((m) => m.body.trim() !== '');

    for (const criterion of prompt.criteria) {
      const seed = hash(`${prompt.ticket.reference}:${criterion.id}`);
      const met = criterion.zeroTolerance || seed % 6 !== 0;
      const line = lines.length > 0 ? lines[seed % lines.length] : undefined;

      answers[criterion.id] = {
        value: met ? 'yes' : 'no',
        rationale: met
          ? `The conversation shows this standard met: ${lower(criterion.label)}.`
          : `No clear evidence in the conversation that the agent ${lower(criterion.label)}.`,
        evidence: line
          ? `${line.author}: "${excerpt(line.body)}"`
          : 'No conversation content was available to quote.',
        // Deterministic, and deliberately never 1.0 — a stand-in grader claiming
        // certainty would misrepresent what this is.
        confidence: Number((0.6 + ((seed % 35) / 100)).toFixed(2)),
      };
    }

    return { status: 'ok', raw: toRawResponse(answers), latencyMs: 0 };
  },
};

/** FNV-1a — small, stable, and dependency-free. Only used for fake determinism. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

const lower = (label: string) => label.charAt(0).toLowerCase() + label.slice(1);

// ── Test doubles ─────────────────────────────────────────────────────────────
// Exported (not test-file-local) so orchestration, API, and UI tests all drive
// the same failure modes through the same seam the real provider will occupy.

/** Answers exactly as scripted — the way to pin an exact score in a test. */
export function scriptedAiProvider(
  answers: Record<string, CriterionValue>,
  rubric = QUALITY_RUBRIC,
): AiReviewProvider {
  return {
    id: 'fake-scripted',
    async grade() {
      const findings = Object.fromEntries(
        allCriteria(rubric)
          .filter((c) => answers[c.id] !== undefined)
          .map((c) => [
            c.id,
            {
              value: answers[c.id],
              rationale: `Scripted answer for ${c.id}.`,
              evidence: `Scripted evidence for ${c.id}.`,
              confidence: 0.9,
            },
          ]),
      );
      return { status: 'ok', raw: toRawResponse(findings), latencyMs: 0 };
    },
  };
}

/** Returns arbitrary text — prose, truncated JSON, an unknown criterion, … */
export function rawAiProvider(raw: string): AiReviewProvider {
  return { id: 'fake-raw', async grade() { return { status: 'ok', raw, latencyMs: 0 }; } };
}

export const unavailableAiProvider: AiReviewProvider = {
  id: 'fake-unavailable',
  async grade() { return { status: 'unavailable' }; },
};

export function errorAiProvider(code = 'provider_error', message = 'The model refused the request.'): AiReviewProvider {
  return { id: 'fake-error', async grade() { return { status: 'error', code, message }; } };
}

/**
 * A provider that breaks its own contract by throwing. Nothing in product code
 * behaves this way — it exists to prove orchestration contains a misbehaving
 * transport instead of letting it reach the HTTP layer.
 */
export const throwingAiProvider: AiReviewProvider = {
  id: 'fake-throwing',
  async grade() { throw new Error('transport exploded'); },
};

// ── Selection ────────────────────────────────────────────────────────────────

let current: AiReviewProvider = fakeAiProvider;

/** The provider orchestration should use. Phase 2 changes this default only. */
export function getAiReviewProvider(): AiReviewProvider {
  return current;
}

export function __setAiReviewProviderForTest(provider: AiReviewProvider): void {
  current = provider;
}

export function __resetAiReviewProviderForTest(): void {
  current = fakeAiProvider;
}
