import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { listReviewable, listReviews } from '../../services/reviewService';
import type { QualityReviewListItem, ReviewableTicket } from '../../models/review';
import { useQuery } from '../../hooks/useQuery';
import { simulatedNowMs } from '../../lib/clock';
import { formatRelativeTime } from '../../lib/utils';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Input } from '../../components/ui/Input';
import { FormField } from '../../components/ui/FormField';
import { ErrorState, LoadingGrid } from '../../components/help/HelpStates';

type Column = 'to_review' | 'in_progress' | 'completed';
type ScoreBand = 'all' | 'gte90' | '70to89' | 'lt70' | 'flagged';

interface Filters {
  team: string;
  agent: string;
  reviewer: string;
  from: string;
  to: string;
  column: 'all' | Column;
  score: ScoreBand;
}

const EMPTY_FILTERS: Filters = { team: '', agent: '', reviewer: '', from: '', to: '', column: 'all', score: 'all' };

/**
 * Quality Reviews — the supervisor board. Three columns (To review / In progress /
 * Completed) over the same data set, with filters for team, agent, reviewer, date,
 * status column, and score. Selecting a ticket opens the shared review workspace.
 */
export function QualityReviews() {
  const reviews = useQuery(useCallback(() => listReviews(), []), []);
  const reviewable = useQuery(useCallback(() => listReviewable(), []), []);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);

  const allReviews = reviews.data ?? [];
  const allReviewable = reviewable.data ?? [];

  // Option lists are derived from the data on screen, so a filter can never point
  // at a value that isn't present. Cheap to recompute; no memoization needed.
  const teamOptions = unique([...allReviews.map((r) => r.teamName), ...allReviewable.map((r) => r.teamName)]);
  const agentOptions = unique([...allReviews.map((r) => r.agentName), ...allReviewable.map((r) => r.agentName)]);
  const reviewerOptions = unique(allReviews.map((r) => r.reviewerName));

  if (reviews.error || reviewable.error) return <ErrorState onRetry={() => { reviews.refetch(); reviewable.refetch(); }} />;
  if (reviews.loading || reviewable.loading) return <LoadingGrid count={3} />;

  const inDateRange = (iso: string) => {
    if (filters.from && iso < filters.from) return false;
    if (filters.to && iso > `${filters.to}T23:59:59Z`) return false;
    return true;
  };

  const toReview = allReviewable.filter(
    (t) =>
      !t.draftReviewId &&
      (!filters.team || t.teamName === filters.team) &&
      (!filters.agent || t.agentName === filters.agent) &&
      inDateRange(t.updatedAt),
  );

  const drafts = allReviews.filter(
    (r) =>
      r.review.status === 'draft' &&
      (!filters.team || r.teamName === filters.team) &&
      (!filters.agent || r.agentName === filters.agent) &&
      (!filters.reviewer || r.reviewerName === filters.reviewer) &&
      inDateRange(r.review.updatedAt),
  );

  const completed = allReviews.filter(
    (r) =>
      r.review.status === 'submitted' &&
      (!filters.team || r.teamName === filters.team) &&
      (!filters.agent || r.agentName === filters.agent) &&
      (!filters.reviewer || r.reviewerName === filters.reviewer) &&
      inDateRange(r.review.submittedAt ?? r.review.updatedAt) &&
      matchesScore(r, filters.score),
  );

  const showColumn = (c: Column) => filters.column === 'all' || filters.column === c;
  const set = (patch: Partial<Filters>) => setFilters((f) => ({ ...f, ...patch }));

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Quality Reviews" subtitle="Review how agents handle tickets, against the current rubric." />

      {/* Filters */}
      <Card>
        <CardContent className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <FormField label="Team">
            {(id) => (
              <Select id={id} value={filters.team} onChange={(e) => set({ team: e.target.value })}>
                <option value="">All teams</option>
                {teamOptions.map((t) => <option key={t} value={t}>{t}</option>)}
              </Select>
            )}
          </FormField>
          <FormField label="Agent">
            {(id) => (
              <Select id={id} value={filters.agent} onChange={(e) => set({ agent: e.target.value })}>
                <option value="">All agents</option>
                {agentOptions.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            )}
          </FormField>
          <FormField label="Reviewer">
            {(id) => (
              <Select id={id} value={filters.reviewer} onChange={(e) => set({ reviewer: e.target.value })}>
                <option value="">All reviewers</option>
                {reviewerOptions.map((r) => <option key={r} value={r}>{r}</option>)}
              </Select>
            )}
          </FormField>
          <FormField label="Status">
            {(id) => (
              <Select id={id} value={filters.column} onChange={(e) => set({ column: e.target.value as Filters['column'] })}>
                <option value="all">All statuses</option>
                <option value="to_review">To review</option>
                <option value="in_progress">In progress</option>
                <option value="completed">Completed</option>
              </Select>
            )}
          </FormField>
          <FormField label="Score">
            {(id) => (
              <Select id={id} value={filters.score} onChange={(e) => set({ score: e.target.value as ScoreBand })}>
                <option value="all">Any score</option>
                <option value="gte90">90% and above</option>
                <option value="70to89">70–89%</option>
                <option value="lt70">Below 70%</option>
                <option value="flagged">Zero-tolerance flagged</option>
              </Select>
            )}
          </FormField>
          <FormField label="From date">
            {(id) => <Input id={id} type="date" value={filters.from} onChange={(e) => set({ from: e.target.value })} />}
          </FormField>
          <FormField label="To date">
            {(id) => <Input id={id} type="date" value={filters.to} onChange={(e) => set({ to: e.target.value })} />}
          </FormField>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              Clear filters
            </button>
          </div>
        </CardContent>
      </Card>

      {showColumn('to_review') && (
        <Column title="To review" count={toReview.length}>
          {toReview.length === 0 ? (
            <Empty>No tickets are waiting to be reviewed.</Empty>
          ) : (
            <ReviewableTable items={toReview} />
          )}
        </Column>
      )}

      {showColumn('in_progress') && (
        <Column title="In progress" count={drafts.length}>
          {drafts.length === 0 ? <Empty>No reviews are in progress.</Empty> : <ReviewTable items={drafts} kind="draft" />}
        </Column>
      )}

      {showColumn('completed') && (
        <Column title="Completed" count={completed.length}>
          {completed.length === 0 ? <Empty>No reviews match these filters.</Empty> : <ReviewTable items={completed} kind="submitted" />}
        </Column>
      )}
    </div>
  );
}

function Column({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-foreground">
        {title}
        <Badge variant="outline">{count}</Badge>
      </h2>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card px-6 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function ReviewableTable({ items }: { items: ReviewableTicket[] }) {
  const now = simulatedNowMs();
  return (
    <TableShell head={['Reference', 'Subject', 'Agent', 'Team', 'Ticket status', 'Updated', '']}>
      {items.map((t) => (
        <tr key={t.ticketId} className="border-b border-border last:border-0 hover:bg-accent/40">
          <td className="px-3 py-2.5 align-top">
            <Link to={`/app/reviews/${t.ticketId}`} className="font-medium text-accent-brand hover:underline">{t.reference}</Link>
          </td>
          <td className="max-w-[240px] truncate px-3 py-2.5 align-top text-foreground" title={t.subject}>{t.subject}</td>
          <td className="px-3 py-2.5 align-top">
            <Link to={`/app/agents/${t.agentId}`} className="text-accent-brand hover:underline">{t.agentName}</Link>
          </td>
          <td className="px-3 py-2.5 align-top text-muted-foreground">{t.teamName}</td>
          <td className="px-3 py-2.5 align-top text-muted-foreground">{t.status}</td>
          <td className="whitespace-nowrap px-3 py-2.5 align-top text-muted-foreground">{formatRelativeTime(t.updatedAt, now)}</td>
          <td className="px-3 py-2.5 align-top text-right">
            <Link to={`/app/reviews/${t.ticketId}`} className="text-sm font-medium text-primary hover:underline">Start review</Link>
          </td>
        </tr>
      ))}
    </TableShell>
  );
}

function ReviewTable({ items, kind }: { items: QualityReviewListItem[]; kind: 'draft' | 'submitted' }) {
  const now = simulatedNowMs();
  return (
    <TableShell
      head={['Reference', 'Subject', 'Agent', 'Reviewer', kind === 'submitted' ? 'Score' : 'Updated', '']}
    >
      {items.map((item) => {
        const { review } = item;
        return (
          <tr key={review.id} className="border-b border-border last:border-0 hover:bg-accent/40">
            <td className="px-3 py-2.5 align-top">
              <Link to={`/app/reviews/${review.ticketId}`} className="font-medium text-accent-brand hover:underline">{item.ticketReference}</Link>
            </td>
            <td className="max-w-[240px] truncate px-3 py-2.5 align-top text-foreground" title={item.ticketSubject}>{item.ticketSubject}</td>
            <td className="px-3 py-2.5 align-top">
              <Link to={`/app/agents/${review.agentId}`} className="text-accent-brand hover:underline">{item.agentName}</Link>
            </td>
            <td className="px-3 py-2.5 align-top text-muted-foreground">{item.reviewerName}</td>
            <td className="px-3 py-2.5 align-top">
              {kind === 'submitted' ? (
                <ScoreBadge item={item} />
              ) : (
                <span className="text-muted-foreground">{formatRelativeTime(review.updatedAt, now)}</span>
              )}
            </td>
            <td className="px-3 py-2.5 align-top text-right">
              <Link to={`/app/reviews/${review.ticketId}`} className="text-sm font-medium text-primary hover:underline">
                {kind === 'submitted' ? 'View' : 'Resume'}
              </Link>
            </td>
          </tr>
        );
      })}
    </TableShell>
  );
}

function ScoreBadge({ item }: { item: QualityReviewListItem }) {
  const score = item.review.score;
  if (!score) return <span className="text-muted-foreground">—</span>;
  const flagged = score.zeroToleranceFailures.length > 0;
  const variant = flagged ? 'destructive' : score.percent !== null && score.percent >= 90 ? 'success' : score.percent !== null && score.percent >= 70 ? 'info' : 'warning';
  return (
    <span className="inline-flex items-center gap-1.5">
      <Badge variant={variant}>{score.percent === null ? '—' : `${score.percent}%`}</Badge>
      {flagged && <Badge variant="destructive" title="Zero-tolerance finding">Flagged</Badge>}
    </span>
  );
}

function TableShell({ head, children }: { head: string[]; children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            {head.map((h, i) => <th key={i} scope="col" className="px-3 py-2 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function matchesScore(item: QualityReviewListItem, band: ScoreBand): boolean {
  if (band === 'all') return true;
  const score = item.review.score;
  if (!score) return false;
  if (band === 'flagged') return score.zeroToleranceFailures.length > 0;
  if (score.percent === null) return false;
  if (band === 'gte90') return score.percent >= 90;
  if (band === '70to89') return score.percent >= 70 && score.percent < 90;
  return score.percent < 70; // lt70
}
