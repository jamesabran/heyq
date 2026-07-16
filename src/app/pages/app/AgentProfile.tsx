import { useCallback } from 'react';
import { Link, useParams } from 'react-router';
import { listReviewable, listReviews } from '../../services/reviewService';
import { agents, teams } from '../../data/catalog';
import { useQuery } from '../../hooks/useQuery';
import { simulatedNowMs } from '../../lib/clock';
import { formatRelativeTime } from '../../lib/utils';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingGrid } from '../../components/help/HelpStates';

/**
 * Agent profile — the second review entry point. Lists the agent's handled tickets
 * (to start a review) and their existing reviews (to resume or read). Selecting any
 * ticket opens the shared review workspace with the ticket + agent pre-filled.
 */
export function AgentProfile() {
  const { agentId = '' } = useParams();
  const reviewable = useQuery(useCallback(() => listReviewable(agentId), [agentId]), [agentId]);
  const reviews = useQuery(useCallback(() => listReviews(), []), []);

  const agent = agents.find((a) => a.id === agentId);
  const teamName = teams.find((t) => t.id === agent?.teamId)?.name;
  const now = simulatedNowMs();

  if (reviewable.error || reviews.error) return <ErrorState onRetry={() => { reviewable.refetch(); reviews.refetch(); }} />;
  if (reviewable.loading || reviews.loading) return <LoadingGrid count={2} />;

  const toReview = reviewable.data ?? [];
  const agentReviews = (reviews.data ?? []).filter((r) => r.review.agentId === agentId);

  return (
    <div className="flex flex-col gap-5">
      <Breadcrumb items={[{ label: 'Quality Reviews', to: '/app/reviews' }, { label: agent?.name ?? 'Agent' }]} />
      <div>
        <h1 className="text-2xl font-bold text-foreground">{agent?.name ?? 'Agent'}</h1>
        <p className="text-sm text-muted-foreground">
          {teamName ? `${teamName} · ` : ''}Quality review history and tickets available to review.
        </p>
      </div>

      {!agent && (
        <EmptyState title="Unknown agent">No agent with this id exists.</EmptyState>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          Tickets to review <Badge variant="outline">{toReview.length}</Badge>
        </h2>
        {toReview.length === 0 ? (
          <Card><CardContent className="px-6 py-8 text-center text-sm text-muted-foreground">No tickets available to review for this agent.</CardContent></Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Reference</th>
                  <th scope="col" className="px-3 py-2 font-medium">Subject</th>
                  <th scope="col" className="px-3 py-2 font-medium">Ticket status</th>
                  <th scope="col" className="px-3 py-2 font-medium">Updated</th>
                  <th scope="col" className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {toReview.map((t) => (
                  <tr key={t.ticketId} className="border-b border-border last:border-0 hover:bg-accent/40">
                    <td className="px-3 py-2.5 align-top">
                      <Link to={`/app/reviews/${t.ticketId}`} className="font-medium text-accent-brand hover:underline">{t.reference}</Link>
                    </td>
                    <td className="max-w-[260px] truncate px-3 py-2.5 align-top text-foreground" title={t.subject}>{t.subject}</td>
                    <td className="px-3 py-2.5 align-top text-muted-foreground">{t.status}</td>
                    <td className="whitespace-nowrap px-3 py-2.5 align-top text-muted-foreground">{formatRelativeTime(t.updatedAt, now)}</td>
                    <td className="px-3 py-2.5 align-top text-right">
                      <Link to={`/app/reviews/${t.ticketId}`} className="text-sm font-medium text-primary hover:underline">
                        {t.draftReviewId ? 'Resume review' : 'Start review'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          Reviews <Badge variant="outline">{agentReviews.length}</Badge>
        </h2>
        {agentReviews.length === 0 ? (
          <Card><CardContent className="px-6 py-8 text-center text-sm text-muted-foreground">No reviews recorded for this agent yet.</CardContent></Card>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 font-medium">Reference</th>
                  <th scope="col" className="px-3 py-2 font-medium">Reviewer</th>
                  <th scope="col" className="px-3 py-2 font-medium">State</th>
                  <th scope="col" className="px-3 py-2 font-medium">Score</th>
                  <th scope="col" className="px-3 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {agentReviews.map((item) => {
                  const { review } = item;
                  const score = review.score;
                  const flagged = (score?.zeroToleranceFailures.length ?? 0) > 0;
                  return (
                    <tr key={review.id} className="border-b border-border last:border-0 hover:bg-accent/40">
                      <td className="px-3 py-2.5 align-top">
                        <Link to={`/app/reviews/${review.ticketId}`} className="font-medium text-accent-brand hover:underline">{item.ticketReference}</Link>
                      </td>
                      <td className="px-3 py-2.5 align-top text-muted-foreground">{item.reviewerName}</td>
                      <td className="px-3 py-2.5 align-top">
                        <Badge variant={review.status === 'submitted' ? 'success' : 'outline'}>
                          {review.status === 'submitted' ? 'Completed' : 'Draft'}
                        </Badge>
                      </td>
                      <td className="px-3 py-2.5 align-top">
                        {score ? (
                          <span className="inline-flex items-center gap-1.5">
                            <Badge variant={flagged ? 'destructive' : 'info'}>{score.percent === null ? '—' : `${score.percent}%`}</Badge>
                            {flagged && <Badge variant="destructive">Flagged</Badge>}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 align-top text-right">
                        <Link to={`/app/reviews/${review.ticketId}`} className="text-sm font-medium text-primary hover:underline">
                          {review.status === 'submitted' ? 'View' : 'Resume'}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
