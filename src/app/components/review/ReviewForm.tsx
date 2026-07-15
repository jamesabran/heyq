import { useMemo, useState } from 'react';
import { IconAlertTriangle, IconAsterisk, IconShieldExclamation } from '@tabler/icons-react';
import type {
  CoachingFeedback,
  CriterionResponses,
  CriterionValue,
  QualityReview,
  RubricCriterion,
} from '../../models/review';
import { CRITERION_VALUE_LABELS } from '../../models/review';
import { QUALITY_RUBRIC, findCriterion } from '../../data/reviewRubric';
import { computeReviewScore } from '../../services/reviewScoring';
import { formatDateTime } from '../../lib/utils';
import { cn } from '../../lib/utils';
import { Alert } from '../ui/Alert';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Textarea } from '../ui/Textarea';

const VALUES: CriterionValue[] = ['yes', 'no', 'na'];
const EMPTY_FEEDBACK: CoachingFeedback = { whatWentWell: '', areasForImprovement: '', reviewerComments: '' };

/**
 * The quality review form. Four SCORED sections of Yes/No/N/A criteria plus a
 * free-text "Coaching feedback" section, a live calculated score, and the two
 * commit actions. "Yes" always means the standard was met; N/A drops a line from
 * the possible score; a No on a zero-tolerance line flags the whole review. A
 * submitted review is read-only — its frozen score and rubric version are shown.
 */
export function ReviewForm({
  review,
  reviewerName,
  saving,
  submitting,
  error,
  onSaveDraft,
  onSubmit,
}: {
  review: QualityReview | null;
  reviewerName: string;
  saving: boolean;
  submitting: boolean;
  error?: string;
  onSaveDraft: (responses: CriterionResponses, feedback: CoachingFeedback) => void;
  onSubmit: (responses: CriterionResponses, feedback: CoachingFeedback) => void;
}) {
  const locked = review?.status === 'submitted';
  const [responses, setResponses] = useState<CriterionResponses>(review?.responses ?? {});
  const [feedback, setFeedback] = useState<CoachingFeedback>(review?.feedback ?? EMPTY_FEEDBACK);

  const score = useMemo(() => computeReviewScore(responses), [responses]);

  const setAnswer = (id: string, value: CriterionValue) =>
    setResponses((prev) => ({ ...prev, [id]: value }));

  const setField = (key: keyof CoachingFeedback, value: string) =>
    setFeedback((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="flex flex-col gap-4">
      <ScorePanel score={score} locked={locked} submittedAt={review?.submittedAt} rubricVersion={review?.rubricVersion} />

      {error && <Alert variant="destructive" icon={<IconAlertTriangle size={18} />}>{error}</Alert>}

      {QUALITY_RUBRIC.sections.map((section) => (
        <Card key={section.id}>
          <CardHeader>
            <CardTitle>{section.title}</CardTitle>
            {section.description && <p className="text-sm text-muted-foreground">{section.description}</p>}
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {section.criteria.map((criterion) => (
              <CriterionField
                key={criterion.id}
                criterion={criterion}
                value={responses[criterion.id]}
                locked={locked}
                onChange={(v) => setAnswer(criterion.id, v)}
              />
            ))}
          </CardContent>
        </Card>
      ))}

      {/* Section 5 — free-text coaching, never scored. */}
      <Card>
        <CardHeader>
          <CardTitle>Coaching feedback</CardTitle>
          <p className="text-sm text-muted-foreground">Narrative notes for the agent. Not scored.</p>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FeedbackField
            label="What went well"
            value={feedback.whatWentWell}
            locked={locked}
            onChange={(v) => setField('whatWentWell', v)}
          />
          <FeedbackField
            label="Areas for improvement"
            value={feedback.areasForImprovement}
            locked={locked}
            onChange={(v) => setField('areasForImprovement', v)}
          />
          <FeedbackField
            label="Reviewer comments"
            value={feedback.reviewerComments}
            locked={locked}
            onChange={(v) => setField('reviewerComments', v)}
          />
        </CardContent>
      </Card>

      {locked ? (
        <p className="px-1 text-sm text-muted-foreground">
          Submitted by {reviewerName}. This review is final and can no longer be edited.
        </p>
      ) : (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {score.unansweredRequired > 0 && (
            <span className="mr-auto text-sm text-muted-foreground">
              {score.unansweredRequired} required {score.unansweredRequired === 1 ? 'criterion' : 'criteria'} left to answer
            </span>
          )}
          <Button variant="outline" disabled={saving || submitting} onClick={() => onSaveDraft(responses, feedback)}>
            {saving ? 'Saving…' : 'Save draft'}
          </Button>
          <Button
            disabled={submitting || saving || score.unansweredRequired > 0}
            onClick={() => onSubmit(responses, feedback)}
          >
            {submitting ? 'Submitting…' : 'Submit review'}
          </Button>
        </div>
      )}
    </div>
  );
}

function ScorePanel({
  score,
  locked,
  submittedAt,
  rubricVersion,
}: {
  score: ReturnType<typeof computeReviewScore>;
  locked: boolean;
  submittedAt?: string;
  rubricVersion?: string;
}) {
  const failed = score.zeroToleranceFailures;
  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Quality score</p>
            <p className="text-4xl font-bold tabular-nums text-foreground">
              {score.percent === null ? '—' : `${score.percent}%`}
            </p>
            <p className="text-xs text-muted-foreground">
              {score.earned} of {score.possible} points{' '}
              <span className="text-muted-foreground/70">(N/A excluded)</span>
            </p>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            {locked ? (
              <>
                <Badge variant="success">Submitted</Badge>
                <p className="mt-1">{formatDateTime(submittedAt)}</p>
              </>
            ) : (
              <Badge variant="outline">Draft</Badge>
            )}
            {rubricVersion && <p className="mt-1">Rubric {rubricVersion}</p>}
          </div>
        </div>

        {failed.length > 0 && (
          <Alert variant="destructive" icon={<IconShieldExclamation size={18} />} title="Zero-tolerance finding">
            <ul className="mt-0.5 list-disc pl-4">
              {failed.map((id) => (
                <li key={id}>{findCriterion(id)?.label ?? id}</li>
              ))}
            </ul>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}

function CriterionField({
  criterion,
  value,
  locked,
  onChange,
}: {
  criterion: RubricCriterion;
  value?: CriterionValue;
  locked: boolean;
  onChange: (value: CriterionValue) => void;
}) {
  return (
    <fieldset className="flex flex-col gap-2 border-0 p-0">
      <legend className="flex flex-wrap items-center gap-2 text-sm font-medium text-foreground">
        <span>{criterion.label}</span>
        <Badge variant="outline" title={`Worth ${criterion.weight} points`}>{criterion.weight} pts</Badge>
        {criterion.required && (
          <span className="inline-flex items-center gap-0.5 text-xs font-medium text-primary" title="Required to submit">
            <IconAsterisk size={11} /> Required
          </span>
        )}
        {criterion.zeroTolerance && (
          <Badge variant="destructive" title="A No here flags the whole review">Zero tolerance</Badge>
        )}
      </legend>
      {criterion.hint && <p className="text-xs text-muted-foreground">{criterion.hint}</p>}
      <div className="flex gap-2" role="radiogroup" aria-label={criterion.label}>
        {VALUES.map((v) => {
          const selected = value === v;
          return (
            <label
              key={v}
              className={cn(
                'flex-1 cursor-pointer rounded-lg border px-3 py-1.5 text-center text-sm font-medium transition-colors',
                selected
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent',
                locked && 'cursor-default opacity-90 hover:bg-background',
              )}
            >
              <input
                type="radio"
                name={`criterion-${criterion.id}`}
                value={v}
                checked={selected}
                disabled={locked}
                onChange={() => onChange(v)}
                className="sr-only"
              />
              {CRITERION_VALUE_LABELS[v]}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function FeedbackField({
  label,
  value,
  locked,
  onChange,
}: {
  label: string;
  value: string;
  locked: boolean;
  onChange: (value: string) => void;
}) {
  if (locked) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <p className="whitespace-pre-wrap rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
          {value.trim() || <span className="text-muted-foreground">—</span>}
        </p>
      </div>
    );
  }
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} className="min-h-20" />
    </label>
  );
}
