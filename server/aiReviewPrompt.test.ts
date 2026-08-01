/**
 * Prompt construction and STRICT response parsing (server/aiReviewPrompt.ts).
 *
 * The parser is the module that decides whether an AI answer is fit for a
 * supervisor to act on, so every rejection path is pinned here: a review must
 * never be assembled out of a half-understood response.
 */
import { describe, expect, it } from 'vitest';
import {
  AI_ALLOWED_VALUES,
  MAX_EVIDENCE_LENGTH,
  MAX_RATIONALE_LENGTH,
  buildReviewPrompt,
  findingsToResponses,
  parseAiReview,
} from './aiReviewPrompt.ts';
import { QUALITY_RUBRIC, allCriteria } from '../src/app/data/reviewRubric.ts';
import type { CriterionValue } from '../src/app/models/review.ts';
import { getTicketDetail } from './tickets.ts';

const CRITERIA = allCriteria(QUALITY_RUBRIC);

/** A complete, well-formed response — the baseline each rejection test breaks. */
function validResponse(overrides: Record<string, unknown> = {}): string {
  const findings: Record<string, unknown> = {};
  for (const c of CRITERIA) {
    findings[c.id] = {
      value: 'yes',
      rationale: `Met: ${c.label}.`,
      evidence: `agent: "…evidence for ${c.id}…"`,
      confidence: 0.8,
    };
  }
  return JSON.stringify({ findings: { ...findings, ...overrides } });
}

describe('buildReviewPrompt', () => {
  it('carries the rubric, the ticket, and the conversation', async () => {
    const evidence = (await getTicketDetail('default', 'tkt-seed-5'))!;
    const prompt = buildReviewPrompt(evidence, {
      rubric: QUALITY_RUBRIC,
      promptVersion: 'v1',
      agentName: 'Alex Cruz',
    });

    expect(prompt.promptVersion).toBe('v1');
    expect(prompt.rubricVersion).toBe(QUALITY_RUBRIC.version);
    // Every criterion is offered for grading, with the flags that matter.
    expect(prompt.criteria).toHaveLength(CRITERIA.length);
    expect(prompt.criteria.find((c) => c.id === 'verified_identity')).toMatchObject({
      required: true,
      zeroTolerance: true,
    });
    expect(prompt.ticket.reference).toBe('HQ-2026-0005');
    expect(prompt.ticket.agentName).toBe('Alex Cruz');
    expect(prompt.conversation.length).toBeGreaterThan(0);
  });

  it('offers only yes/no — N/A is withheld from the AI', async () => {
    const evidence = (await getTicketDetail('default', 'tkt-seed-5'))!;
    const prompt = buildReviewPrompt(evidence, { rubric: QUALITY_RUBRIC, promptVersion: 'v1', agentName: 'A' });
    expect(prompt.allowedValues).toEqual(['yes', 'no']);
    expect(AI_ALLOWED_VALUES).not.toContain('na');
  });
});

describe('parseAiReview — accepts', () => {
  it('parses a complete, well-formed response', () => {
    const parsed = parseAiReview(validResponse(), QUALITY_RUBRIC);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(Object.keys(parsed.findings)).toHaveLength(CRITERIA.length);
    expect(parsed.findings.greeting.value).toBe('yes');
  });

  it('preserves a rationale, evidence, and confidence for every criterion', () => {
    const parsed = parseAiReview(
      validResponse({
        empathy: {
          value: 'no',
          rationale: 'Never named the impact on the customer.',
          evidence: 'agent: "Your parcel is delayed."',
          confidence: 0.55,
        },
      }),
      QUALITY_RUBRIC,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.findings.empathy).toEqual({
      value: 'no',
      rationale: 'Never named the impact on the customer.',
      evidence: 'agent: "Your parcel is delayed."',
      confidence: 0.55,
    });
    for (const c of CRITERIA) {
      expect(parsed.findings[c.id].rationale).not.toBe('');
      expect(parsed.findings[c.id].evidence).not.toBe('');
    }
  });

  it('accepts a finding with no confidence — it is optional', () => {
    const parsed = parseAiReview(
      validResponse({ clarity: { value: 'yes', rationale: 'Plain language.', evidence: 'agent: "…"' } }),
      QUALITY_RUBRIC,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.findings.clarity.confidence).toBeUndefined();
    expect(parsed.findings.clarity.evidence).toBe('agent: "…"');
  });

  it('bounds an over-long evidence excerpt', () => {
    const parsed = parseAiReview(
      validResponse({ greeting: { value: 'yes', rationale: 'Fine.', evidence: 'y'.repeat(1000) } }),
      QUALITY_RUBRIC,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.findings.greeting.evidence).toHaveLength(MAX_EVIDENCE_LENGTH);
  });

  it('trims and bounds an over-long rationale rather than storing it whole', () => {
    const parsed = parseAiReview(
      validResponse({ greeting: { value: 'yes', rationale: `  ${'x'.repeat(1000)}  `, evidence: 'agent: "x"' } }),
      QUALITY_RUBRIC,
    );
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.findings.greeting.rationale).toHaveLength(MAX_RATIONALE_LENGTH);
  });
});

describe('parseAiReview — rejects', () => {
  const reject = (raw: string) => {
    const parsed = parseAiReview(raw, QUALITY_RUBRIC);
    expect(parsed.ok).toBe(false);
    return parsed as Extract<typeof parsed, { ok: false }>;
  };

  it('provider prose instead of JSON', () => {
    expect(reject('Sure! Here is my assessment of the agent.').code).toBe('invalid_json');
  });

  it('invalid / truncated JSON', () => {
    expect(reject('{"findings": {"greeting": {"value": "yes"').code).toBe('invalid_json');
  });

  it('JSON with no findings object', () => {
    expect(reject(JSON.stringify({ result: 'good' })).code).toBe('malformed_shape');
    expect(reject(JSON.stringify({ findings: [] })).code).toBe('malformed_shape');
  });

  it('an answer that is not an object', () => {
    expect(reject(validResponse({ greeting: 'yes' })).code).toBe('malformed_shape');
  });

  it('an unknown criterion id', () => {
    const err = reject(validResponse({ agent_was_nice: { value: 'yes', rationale: 'Invented.' } }));
    expect(err.code).toBe('unknown_criterion');
    expect(err.message).toMatch(/agent_was_nice/);
  });

  it('a missing REQUIRED criterion', () => {
    const findings = JSON.parse(validResponse()).findings;
    delete findings.empathy; // required
    expect(reject(JSON.stringify({ findings })).code).toBe('missing_criterion');
  });

  it('a missing optional criterion — a partial answer set is still incomplete', () => {
    const findings = JSON.parse(validResponse()).findings;
    delete findings.greeting; // not required, but still part of the rubric
    // Accepting this would compute a percentage over whichever subset the model
    // felt like answering, so it is refused too.
    expect(reject(JSON.stringify({ findings })).code).toBe('missing_criterion');
  });

  it('an unsupported value', () => {
    expect(reject(validResponse({ clarity: { value: 'maybe', rationale: 'Unsure.' } })).code).toBe(
      'unsupported_value',
    );
    expect(reject(validResponse({ clarity: { value: 5, rationale: 'Numeric.' } })).code).toBe('unsupported_value');
  });

  it('N/A — withheld from the AI so it cannot shrink its own denominator', () => {
    const err = reject(validResponse({ timely_handling: { value: 'na', rationale: 'Not applicable.' } }));
    expect(err.code).toBe('unsupported_value');
    expect(err.message).toMatch(/yes or no/);
  });

  it('an answer with no rationale', () => {
    expect(reject(validResponse({ clarity: { value: 'yes', evidence: 'agent: "x"' } })).code).toBe(
      'missing_rationale',
    );
    expect(
      reject(validResponse({ clarity: { value: 'yes', rationale: '   ', evidence: 'agent: "x"' } })).code,
    ).toBe('missing_rationale');
  });

  it('an answer with no evidence from the transcript', () => {
    expect(reject(validResponse({ clarity: { value: 'yes', rationale: 'Clear.' } })).code).toBe('missing_evidence');
    expect(reject(validResponse({ clarity: { value: 'yes', rationale: 'Clear.', evidence: ' ' } })).code).toBe(
      'missing_evidence',
    );
  });

  it('a confidence that is not a 0–1 number', () => {
    const withConfidence = (confidence: unknown) =>
      validResponse({ clarity: { value: 'yes', rationale: 'Clear.', evidence: 'agent: "x"', confidence } });

    expect(reject(withConfidence(1.5)).code).toBe('invalid_confidence');
    expect(reject(withConfidence(-0.1)).code).toBe('invalid_confidence');
    expect(reject(withConfidence(80)).code).toBe('invalid_confidence'); // a percentage, not a ratio
    expect(reject(withConfidence('high')).code).toBe('invalid_confidence');
  });
});

describe('findingsToResponses', () => {
  it('reduces findings to the answer map the scorer consumes', () => {
    const parsed = parseAiReview(
      validResponse({ clarity: { value: 'no', rationale: 'Heavy jargon.', evidence: 'agent: "ETA per SLA T+2"' } }),
      QUALITY_RUBRIC,
    );
    if (!parsed.ok) throw new Error('expected a valid parse');
    const responses = findingsToResponses(parsed.findings);
    expect(responses.clarity).toBe<CriterionValue>('no');
    expect(responses.greeting).toBe<CriterionValue>('yes');
    expect(Object.keys(responses)).toHaveLength(CRITERIA.length);
  });
});
