import { IconAlertTriangle, IconSparkles } from '@tabler/icons-react';
import {
  SUPERVISOR_REQUIRED_REASON_LABELS,
  type CriterionValue,
  type QualityReview,
} from '../../models/review';
import { findCriterion } from '../../data/reviewRubric';
import { summarizeAiReview } from '../../services/aiReviewSummary';
import { REVIEW_BLOCKED_MESSAGE } from '../../services/reviewEligibility';
import { formatDateTime } from '../../lib/utils';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { ReviewTypeBadge } from './ReviewTypeBadge';

/**
 * The AI review for a ticket, shown read-only beside the supervisor form.
 *
 * Written for the person who has to ACT on it. A supervisor's questions are:
 * what did it score, did it pass, do I still have to review this and why, what
 * did it actually find. Those are the card, in that order; the findings sit one
 * click away so an answer can always be checked against the transcript.
 *
 * What it deliberately does NOT show: which model or provider ran it, the rubric
 * and prompt versions, the configured threshold, average confidence, latency —
 * every one of those is still STORED on the record for audit and debugging (see
 * AiReviewMeta), and none of them helps a supervisor decide anything. Showing
 * them asks a team lead to reason about our infrastructure to grade an agent.
 *
 * It is also NOT a second form: it has no answer controls and never writes to
 * the supervisor's review.
 */
export function AiReviewPanel({
  review,
  eligible,
  running,
  error,
  onRun,
}: {
  review: QualityReview | null;
  /** Whether the ticket is finished and may be reviewed at all. */
  eligible: boolean;
  running: boolean;
  error?: string;
  onRun: () => void;
}) {
  const ai = review?.ai;
  const score = review?.score;
  const failed = ai?.status === 'failed';
  const inProgress = running || ai?.status === 'running';
  const succeeded = ai?.status === 'succeeded' && !!ai.findings;
  const summary = summarizeAiReview(review);
  // "Flagged" is the record's own frozen conclusion, not a number re-derived
  // here — a zero-tolerance finding, a score under the threshold, or nothing
  // scorable all land in it, and all mean the same thing to a supervisor.
  const flagged = review?.supervisorReviewRequired === true;

  return (
    <Card role="region" aria-label="AI review">
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ReviewTypeBadge review={review ?? { reviewType: 'ai' }} />
            {succeeded && score && (
              <Badge variant={flagged ? 'destructive' : 'info'}>
                {score.percent === null ? '—' : `${score.percent}%`}
              </Badge>
            )}
            {succeeded && <Badge variant={flagged ? 'destructive' : 'success'}>{flagged ? 'Flagged' : 'Passed'}</Badge>}
          </div>
          {/* An active ticket has nothing finished to grade, so the action is
              gone rather than merely failing when pressed. */}
          {eligible && (
            <Button variant="outline" size="sm" disabled={inProgress} onClick={onRun}>
              <IconSparkles size={15} />
              {inProgress ? 'Running…' : review ? 'Re-run AI review' : 'Run AI review'}
            </Button>
          )}
        </div>

        {/* A refused request (AI turned off, or not a reviewer) — the server's
            message, shown as-is rather than reinterpreted. */}
        {error && <Alert variant="warning" icon={<IconAlertTriangle size={18} />}>{error}</Alert>}

        {!eligible && <p className="text-sm text-muted-foreground">{REVIEW_BLOCKED_MESSAGE}</p>}

        {eligible && inProgress && (
          <p className="text-sm text-muted-foreground">
            The AI review is running. It started when this ticket was resolved — reload in a moment to see the result.
          </p>
        )}

        {eligible && !review && !inProgress && !error && (
          <p className="text-sm text-muted-foreground">
            No AI review yet. Running one scores this ticket against the same rubric you use — as a starting point for
            your own review, never a replacement for it.
          </p>
        )}

        {/* Operational, not technical: the supervisor's next move is the same
            whichever transport failed, and the stored error code is for whoever
            is debugging it, not for them. */}
        {failed && (
          <Alert variant="warning" title="The AI review didn't complete">
            No AI assessment is available for this ticket. Re-run it, or review the ticket yourself — the outcome does
            not depend on the AI.
          </Alert>
        )}

        {review?.supervisorReviewRequired && (
          <Alert variant="warning" title="Supervisor review required">
            {review.supervisorReviewReason
              ? SUPERVISOR_REQUIRED_REASON_LABELS[review.supervisorReviewReason]
              : 'This ticket needs a supervisor review.'}
          </Alert>
        )}

        {succeeded && (
          <>
            {summary && <p className="text-sm text-foreground">{summary.text}</p>}
            <p className="text-xs text-muted-foreground">
              Generated {formatDateTime(review?.submittedAt ?? review?.updatedAt)}. Check the findings against the
              conversation before acting on them.
            </p>
            <CollapsibleSection title="AI findings" meta={`${Object.keys(ai.findings!).length} criteria`}>
              <ul className="flex flex-col gap-4">
                {Object.entries(ai.findings!).map(([id, finding]) => (
                  <li key={id} className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-start gap-2 text-sm font-medium text-foreground">
                      <AnswerBadge value={finding.value} />
                      <span>{findCriterion(id)?.label ?? id}</span>
                      {/* Per-criterion confidence stays here, next to the answer
                          it qualifies, where it is genuinely useful. It is not
                          averaged into a headline number: model self-reported
                          confidence is not calibrated enough to read that way. */}
                      {finding.confidence !== undefined && (
                        <span className="text-xs font-normal text-muted-foreground">
                          {Math.round(finding.confidence * 100)}% confidence
                        </span>
                      )}
                    </span>
                    <p className="pl-1 text-xs text-muted-foreground">{finding.rationale}</p>
                    {/* The transcript excerpt the answer rests on, so a supervisor
                        can check it without hunting through the conversation. */}
                    <blockquote className="border-l-2 border-border pl-2 text-xs italic text-muted-foreground">
                      {finding.evidence}
                    </blockquote>
                  </li>
                ))}
              </ul>
            </CollapsibleSection>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function AnswerBadge({ value }: { value: CriterionValue }) {
  if (value === 'yes') return <Badge variant="success">Yes</Badge>;
  if (value === 'no') return <Badge variant="warning">No</Badge>;
  return <Badge variant="outline">N/A</Badge>;
}
