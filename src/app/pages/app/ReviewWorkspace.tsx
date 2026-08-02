import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import {
  getReviewWorkspace,
  runAiReview,
  saveDraft,
  submitReview,
} from '../../services/reviewService';
import type { CoachingFeedback, CriterionResponses } from '../../models/review';
import { isReviewEligible } from '../../services/reviewEligibility';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { useIdentity } from '../../contexts/IdentityContext';
import { Alert } from '../../components/ui/Alert';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { EmptyState, ErrorState, LoadingGrid } from '../../components/help/HelpStates';
import { AiReviewPanel } from '../../components/review/AiReviewPanel';
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
  const aiMutation = useMutation(runAiReview);
  const [savedNote, setSavedNote] = useState(false);

  if (workspace.error) return <ErrorState onRetry={workspace.refetch} />;
  // Only show the full-page loader while there is nothing for THIS ticket to
  // show. A refetch triggered by an in-page action (saving a draft, running an
  // AI review) must not unmount the form underneath the supervisor — that would
  // silently discard answers they have typed but not yet saved. Navigating to a
  // different ticket still loads, because the retained data is the old ticket's.
  if (workspace.loading && data?.ticketId !== ticketId) return <LoadingGrid count={3} />;
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

  /**
   * Run the AI reviewer. This writes ONLY the ticket's AI review record, so the
   * supervisor form below keeps whatever has been typed into it — nothing is
   * copied across, and a failure changes nothing but the AI panel.
   */
  async function onRunAiReview() {
    await aiMutation.mutate(ticketId, identity.id).catch(() => {
      // Refused (disabled / not authorized) — surfaced by aiMutation.error below.
    });
    refresh();
  }

  const mutationError = submitMutation.error?.message ?? draftMutation.error?.message;
  // Read from the ticket the workspace already loaded, through the SAME rule the
  // server enforces — so a hidden button and a refused request can never disagree.
  // The server is still the control: this only spares a supervisor a pointless error.
  const eligible = isReviewEligible(data.evidence.ticket);

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
        <div className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] lg:overflow-y-auto lg:pb-4">
          {/* Any AI review sits ABOVE the form as read-only context. It never
              prefills the supervisor's answers — the two records stay separate. */}
          <AiReviewPanel
            review={data.aiReview}
            eligible={eligible}
            running={aiMutation.loading}
            error={aiMutation.error?.message}
            onRun={onRunAiReview}
          />
          <ReviewForm
            review={data.review}
            eligible={eligible}
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
