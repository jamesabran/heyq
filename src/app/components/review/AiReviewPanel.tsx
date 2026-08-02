import { IconAlertTriangle, IconSparkles } from '@tabler/icons-react';
import {
  SUPERVISOR_REQUIRED_REASON_LABELS,
  type AiFinding,
  type CriterionValue,
  type QualityReview,
} from '../../models/review';
import { findCriterion } from '../../data/reviewRubric';
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
 * Deliberately NOT a second form: it has no answer controls and never writes to
 * the supervisor's review. Every criterion is shown with the AI's own rationale,
 * because a score a supervisor cannot check against the conversation is not
 * something they can reasonably act on.
 */
export function AiReviewPanel({
  review,
  running,
  error,
  onRun,
}: {
  review: QualityReview | null;
  running: boolean;
  error?: string;
  onRun: () => void;
}) {
  const ai = review?.ai;
  const score = review?.score;
  const flagged = (score?.zeroToleranceFailures.length ?? 0) > 0;
  const failed = ai?.status === 'failed';

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ReviewTypeBadge review={review ?? { reviewType: 'ai' }} />
            {!failed && score && (
              <Badge variant={flagged ? 'destructive' : 'info'}>
                {score.percent === null ? '—' : `${score.percent}%`}
              </Badge>
            )}
            {flagged && <Badge variant="destructive">Flagged</Badge>}
          </div>
          <Button variant="outline" size="sm" disabled={running} onClick={onRun}>
            <IconSparkles size={15} />
            {running ? 'Running…' : review ? 'Re-run AI review' : 'Run AI review'}
          </Button>
        </div>

        {/* A refused request (AI turned off, or not a reviewer) — the server's
            message, shown as-is rather than reinterpreted. */}
        {error && <Alert variant="warning" icon={<IconAlertTriangle size={18} />}>{error}</Alert>}

        {!review && !error && (
          <p className="text-sm text-muted-foreground">
            No AI review yet. Running one scores this ticket against the same rubric you use — as a starting point for
            your own review, never a replacement for it.
          </p>
        )}

        {failed && (
          <Alert variant="warning" title="The AI review didn't complete">
            {ai?.error?.message ?? 'The AI reviewer could not produce a result.'}
          </Alert>
        )}

        {review?.supervisorReviewRequired && (
          <Alert variant="warning" title="Supervisor review required">
            {review.supervisorReviewReason
              ? SUPERVISOR_REQUIRED_REASON_LABELS[review.supervisorReviewReason]
              : 'This ticket needs a supervisor review.'}
          </Alert>
        )}

        {ai?.status === 'succeeded' && ai.findings && (
          <>
            <p className="text-sm text-muted-foreground">
              Generated {formatDateTime(review?.submittedAt ?? review?.updatedAt)} · {ai.model} · rubric{' '}
              {review?.rubricVersion} · prompt {ai.promptVersion}
              {review?.thresholdPercent !== undefined && ` · threshold ${review.thresholdPercent}%`}
              {averageConfidence(ai.findings) !== null && ` · ${averageConfidence(ai.findings)}% average confidence`}.
              Check the findings against the conversation before acting on them.
            </p>
            <CollapsibleSection title="AI findings" meta={`${Object.keys(ai.findings).length} criteria`}>
              <ul className="flex flex-col gap-4">
                {Object.entries(ai.findings).map(([id, finding]) => (
                  <li key={id} className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-start gap-2 text-sm font-medium text-foreground">
                      <AnswerBadge value={finding.value} />
                      <span>{findCriterion(id)?.label ?? id}</span>
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

/**
 * Mean self-reported confidence across the findings, as a percentage. Shown for
 * context only — nothing about the score or whether a supervisor review is
 * required depends on it, because model self-reported confidence is not
 * calibrated enough to carry that weight.
 */
function averageConfidence(findings: Record<string, AiFinding>): number | null {
  const values = Object.values(findings)
    .map((f) => f.confidence)
    .filter((c): c is number => typeof c === 'number');
  if (values.length === 0) return null;
  return Math.round((values.reduce((sum, c) => sum + c, 0) / values.length) * 100);
}

function AnswerBadge({ value }: { value: CriterionValue }) {
  if (value === 'yes') return <Badge variant="success">Yes</Badge>;
  if (value === 'no') return <Badge variant="warning">No</Badge>;
  return <Badge variant="outline">N/A</Badge>;
}
