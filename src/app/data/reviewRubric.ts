// The default Quality Review rubric (v1). Kept as data — separate from scoring
// logic (services/reviewScoring.ts) and from the form UI — so a future admin
// editor or a v2 can replace it without touching either. Every criterion is
// phrased so that "Yes" means the standard was MET (scoring rule 1); a handful
// are marked `required` (must be answered to submit) or `zeroTolerance` (a No
// flags the whole review regardless of the average — compliance breaches).
//
// The five sections the product asks for map as: four SCORED sections here, plus
// a fifth "Coaching feedback" section that is free-text only (What went well /
// Areas for improvement / Reviewer comments) and therefore lives on the review as
// `feedback`, not as scored criteria.
//
// `shortLabel` is display metadata only — a two-or-three word name used where a
// full criterion label will not fit in a sentence (the AI review summary). It
// changes nothing about what is assessed, weighted, required, or zero tolerance.
import type { Rubric } from '../models/review';

export const QUALITY_RUBRIC: Rubric = {
  version: 'v1',
  sections: [
    {
      id: 'communication',
      title: 'Communication and empathy',
      description: 'How the agent spoke to the customer.',
      criteria: [
        { id: 'greeting', label: 'Opened with a professional, on-brand greeting', shortLabel: 'greeting', weight: 5 },
        {
          id: 'empathy',
          label: "Acknowledged the customer's concern with genuine empathy",
          shortLabel: 'empathy',
          hint: 'Named the impact, not just the facts.',
          weight: 10,
          required: true,
        },
        { id: 'clarity', label: 'Used clear, jargon-free language', shortLabel: 'clarity', weight: 5 },
        {
          id: 'respectful_tone',
          label: 'Maintained a respectful, courteous tone throughout',
          shortLabel: 'tone',
          hint: 'A rude or dismissive reply fails this outright.',
          weight: 10,
          zeroTolerance: true,
        },
      ],
    },
    {
      id: 'investigation',
      title: 'Investigation and ownership',
      description: 'Whether the agent dug in and owned the problem.',
      criteria: [
        {
          id: 'reviewed_context',
          label: 'Reviewed the ticket history and linked order before responding',
          shortLabel: 'ticket context',
          weight: 10,
          required: true,
        },
        {
          id: 'used_evidence',
          label: 'Used the transaction / order evidence to investigate',
          shortLabel: 'use of evidence',
          weight: 10,
        },
        {
          id: 'took_ownership',
          label: 'Took ownership instead of deflecting or bouncing the customer',
          shortLabel: 'ownership',
          weight: 10,
        },
        {
          id: 'accurate_diagnosis',
          label: 'Correctly diagnosed the underlying issue',
          shortLabel: 'diagnosis',
          weight: 10,
          required: true,
        },
      ],
    },
    {
      id: 'resolution',
      title: 'Resolution and process',
      description: 'Whether the outcome was correct and complete.',
      criteria: [
        {
          id: 'followed_process',
          label: 'Followed the correct process and policy for this concern',
          shortLabel: 'process',
          weight: 10,
          required: true,
        },
        {
          id: 'complete_resolution',
          label: 'Provided a complete, correct resolution (or a clear next step)',
          shortLabel: 'resolution',
          weight: 15,
          required: true,
        },
        { id: 'set_expectations', label: 'Set clear next steps and expectations', shortLabel: 'expectations', weight: 5 },
        { id: 'timely_handling', label: 'Handled the ticket within a reasonable time', shortLabel: 'timeliness', weight: 5 },
      ],
    },
    {
      id: 'compliance',
      title: 'Compliance and conduct',
      description: 'Non-negotiable conduct and data-handling standards.',
      criteria: [
        {
          id: 'verified_identity',
          label: 'Verified the requester before sharing account or order details',
          shortLabel: 'identity verification',
          hint: 'Zero tolerance — a No flags the review.',
          weight: 10,
          required: true,
          zeroTolerance: true,
        },
        {
          id: 'data_privacy',
          label: 'Protected personal and payment data (no improper disclosure)',
          shortLabel: 'data privacy',
          hint: 'Zero tolerance — a No flags the review.',
          weight: 10,
          zeroTolerance: true,
        },
        {
          id: 'no_unauthorized_promises',
          label: 'Made no unauthorized commitments (refunds, credits, fee waivers)',
          shortLabel: 'unauthorized commitments',
          weight: 5,
        },
      ],
    },
  ],
};

/** Flatten the rubric to its criteria — handy for lookups and scoring. */
export function allCriteria(rubric: Rubric = QUALITY_RUBRIC) {
  return rubric.sections.flatMap((s) => s.criteria);
}

/** Look up a criterion by id across all sections. */
export function findCriterion(id: string, rubric: Rubric = QUALITY_RUBRIC) {
  return allCriteria(rubric).find((c) => c.id === id);
}
