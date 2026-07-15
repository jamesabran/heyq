import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import {
  getReviewWorkspace,
  saveDraft,
  submitReview,
} from '../../services/reviewService';
import type { CoachingFeedback, CriterionResponses } from '../../models/review';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { useIdentity } from '../../contexts/IdentityContext';
import { Alert } from '../../components/ui/Alert';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingGrid } from '../../components/help/HelpStates';
import { EvidencePane } from '../../components/review/EvidencePane';
import { ReviewForm } from '../../components/review/ReviewForm';

/**
 * The review workspace — the shared destination of all three entry points
 * (Quality Reviews page, agent profile, ticket details). Ticket + agent are
 * pre-filled and locked. Layout: read-only evidence on the left (conversation
 * primary), the quality review pane on the right, scrolling independently.
 */
export function ReviewWorkspace() {
  const { ticketId = '' } = useParams();
  const { identity } = useIdentity();
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  const [submitted, setSubmitted] = useState(false);

  const workspace = useQuery(useCallback(() => getReviewWorkspace(ticketId), [ticketId]), [ticketId, version]);
  const data = workspace.data;

  const draftMutation = useMutation(saveDraft);
  const submitMutation = useMutation(submitReview);
  const [savedNote, setSavedNote] = useState(false);

  if (workspace.error) return <ErrorState onRetry={workspace.refetch} />;
  if (workspace.loading) return <LoadingGrid count={3} />;
  if (!data) return <EmptyState title="Ticket not found">This ticket doesn&apos;t exist.</EmptyState>;

  if (!data.agentId) {
    return (
      <div className="flex flex-col gap-4">
        <Breadcrumb items={[{ label: 'Quality Reviews', to: '/app/reviews' }, { label: 'Review' }]} />
        <EmptyState title="Nothing to review yet">
          This ticket has no assigned agent, so there is no handling to review. Assign it first.
        </EmptyState>
      </div>
    );
  }

  async function onSaveDraft(responses: CriterionResponses, feedback: CoachingFeedback) {
    await draftMutation.mutate({ ticketId, reviewerId: identity.id, responses, feedback });
    setSavedNote(true);
    setTimeout(() => setSavedNote(false), 2500);
    refresh();
  }

  async function onSubmit(responses: CriterionResponses, feedback: CoachingFeedback) {
    await submitMutation.mutate({ ticketId, reviewerId: identity.id, responses, feedback });
    setSubmitted(true);
    refresh();
  }

  const mutationError = submitMutation.error?.message ?? draftMutation.error?.message;

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb
        items={[{ label: 'Quality Reviews', to: '/app/reviews' }, { label: data.evidence.ticket.reference }]}
      />
      <div>
        <h1 className="text-2xl font-bold text-foreground">Quality review</h1>
        <p className="text-sm text-muted-foreground">
          Reviewing {data.agentName}&apos;s handling of {data.evidence.ticket.reference} · {data.teamName}
        </p>
      </div>

      {submitted && (
        <Alert variant="success" title="Review submitted">
          The score and rubric version are now locked in the review history.
        </Alert>
      )}
      {savedNote && !submitted && <Alert variant="info">Draft saved.</Alert>}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)]">
        {/* Left: read-only evidence, scrolls with the page. */}
        <div className="min-w-0">
          <EvidencePane evidence={data.evidence} agentName={data.agentName} />
        </div>

        {/* Right: the review pane, sticky and independently scrollable. */}
        <div className="min-w-0 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pb-4">
          <ReviewForm
            review={data.review}
            reviewerName={identity.name}
            saving={draftMutation.loading}
            submitting={submitMutation.loading}
            error={mutationError}
            onSaveDraft={onSaveDraft}
            onSubmit={onSubmit}
          />
        </div>
      </div>
    </div>
  );
}
