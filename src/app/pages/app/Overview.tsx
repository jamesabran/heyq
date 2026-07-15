import { useCallback, useMemo } from 'react';
import { Link } from 'react-router';
import { IconCircleCheck, IconClockExclamation, IconPlus } from '@tabler/icons-react';
import {
  getOverview,
  type AttentionList,
  type KbOverview,
  type OverviewCounter,
  type RequesterOverview,
  type TicketOverview,
} from '../../services/overviewService';
import type { RequesterTicketSummary } from '../../services/requesterService';
import { useQuery } from '../../hooks/useQuery';
import {
  useStaleTransactionRefresh,
  type RefreshedTransaction,
  type StaleRefreshTarget,
} from '../../hooks/useStaleTransactionRefresh';
import { useIdentity, type Identity } from '../../contexts/IdentityContext';
import { AGENT_ROLES } from '../../lib/roles';
import { cn, formatDate } from '../../lib/utils';
import { PageHeader } from '../../components/layout/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { buttonVariants } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { BarList } from '../../components/reports/charts';
import { TicketTable, type RowTransactionContext } from '../../components/ticket/TicketTable';
import { StatusChip } from '../../components/ticket/StatusChip';
import { EmptyState, ErrorState, LoadingGrid } from '../../components/help/HelpStates';

/**
 * The default authenticated landing page (M19). One page whose *content* branches
 * by role — not a widget system, and not a replacement for the ticket workspace:
 * every counter and row links into the real queues or the ticket detail.
 */
export function Overview() {
  const { identity } = useIdentity();
  const { id, role, teamId, requesterId } = identity;

  const overview = useQuery(
    useCallback(
      () => getOverview({ id, role, teamId, requesterId }),
      [id, role, teamId, requesterId],
    ),
    [id, role, teamId, requesterId],
  );

  if (overview.error) return <ErrorState onRetry={overview.refetch} />;
  if (overview.loading || !overview.data) return <LoadingGrid count={4} />;

  const data = overview.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={`Welcome, ${firstName(identity.name)}`} subtitle={subtitleFor(identity)} />
        {AGENT_ROLES.includes(role) && (
          <Link to="/app/tickets/new" className={buttonVariants({ variant: 'default', size: 'sm' })}>
            <IconPlus size={16} className="mr-1" />
            New ticket
          </Link>
        )}
      </div>

      {data.kind === 'tickets' && <TicketOverviewBody data={data} viewerTeamId={teamId} />}
      {data.kind === 'kb' && <KbOverviewBody data={data} />}
      {data.kind === 'requester' && <RequesterOverviewBody data={data} />}
    </div>
  );
}

function firstName(name: string): string {
  return name.split(' ')[0];
}

function subtitleFor(identity: Identity): string {
  switch (identity.role) {
    case 'customer':
      return 'Your tickets with GGX support.';
    case 'kb_editor':
      return 'Your knowledge-base publishing queue.';
    case 'admin':
      return 'What needs attention across every team.';
    case 'team_lead':
      return `What needs attention in ${identity.teamName ?? 'your team'}.`;
    default:
      return 'What needs your attention first.';
  }
}

// ── Agent / supervisor / admin ───────────────────────────────────────────────

function TicketOverviewBody({ data, viewerTeamId }: { data: TicketOverview; viewerTeamId?: string }) {
  // Three distinct "nothing to show" states, and they mean different things:
  // no tickets at all, vs. tickets exist but none need attention right now.
  const nothingNeedsAttention = data.lists.every((l) => l.rows.length === 0);

  // Auto-refresh the stale transaction snapshots on the visible rows in the
  // background (deduped by external order), instead of asking the agent to open
  // each ticket. The saved snapshot keeps showing until a refresh resolves.
  const staleTargets = useMemo<StaleRefreshTarget[]>(() => {
    const seen = new Set<string>();
    const targets: StaleRefreshTarget[] = [];
    for (const list of data.lists) {
      for (const row of list.rows) {
        const txnId = row.item.ticket.relatedTransactionId;
        if (row.transaction?.stale && txnId && !seen.has(txnId)) {
          seen.add(txnId);
          targets.push({ id: txnId, viewerTeamId });
        }
      }
    }
    return targets;
  }, [data.lists, viewerTeamId]);

  const { refreshed, failedCount } = useStaleTransactionRefresh(staleTargets);

  if (!data.hasWork) {
    return (
      <EmptyState
        title="No tickets in your scope"
        action={
          <Link to="/app/unassigned" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            Browse the unassigned pool
          </Link>
        }
      >
        Nothing has been assigned to you or your team yet. New tickets will land here.
      </EmptyState>
    );
  }

  return (
    <>
      {failedCount > 0 && (
        <Alert
          variant="warning"
          icon={<IconClockExclamation size={18} />}
          title="Couldn't refresh some transaction data"
        >
          {failedCount === 1 ? 'One ticket' : `${failedCount} tickets`} couldn&apos;t be refreshed from
          GGX just now — the latest saved shipment and payment details are still shown. Open the ticket
          to retry.
        </Alert>
      )}

      <CounterGrid counters={data.counters} />

      {nothingNeedsAttention ? (
        <Alert variant="success" icon={<IconCircleCheck size={18} />} title="All clear">
          There is open work in your scope, but nothing is urgent, reopened, or against the SLA clock
          right now.
        </Alert>
      ) : (
        data.lists.map((list) => <AttentionSection key={list.key} list={list} refreshed={refreshed} />)
      )}

      {data.trend && (
        <div className="grid gap-4 lg:grid-cols-2">
          <BarList title={data.trend.title} buckets={data.trend.buckets} />
        </div>
      )}
    </>
  );
}

/** A counter card. The whole card is the link — the number is never a dead end. */
function CounterGrid({ counters }: { counters: OverviewCounter[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
      {counters.map((c) => (
        <Link key={c.key} to={c.to} className="group block focus-visible:outline-none">
          <Card className="h-full transition-colors group-hover:border-accent-brand/40">
            <CardContent className="p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{c.label}</p>
              <p
                className={cn(
                  'mt-1 text-2xl font-bold',
                  c.value === 0
                    ? 'text-muted-foreground'
                    : c.tone === 'danger'
                      ? 'text-destructive'
                      : c.tone === 'warning'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-foreground',
                )}
              >
                {c.value}
              </p>
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

/** An attention list. An empty one is dropped — the "all clear" state covers it. */
function AttentionSection({
  list,
  refreshed,
}: {
  list: AttentionList;
  refreshed: Record<string, RefreshedTransaction>;
}) {
  if (list.rows.length === 0) return null;

  // The shared TicketTable renders the rows; the Overview simply hands it the GGX
  // transaction context the queues don't carry. Where a background refresh has
  // landed, the fresh shipment/payment replaces the saved snapshot and the stale
  // marker clears; otherwise the saved snapshot keeps showing.
  const items = list.rows.map((r) => r.item);
  const context: Record<string, RowTransactionContext> = {};
  for (const row of list.rows) {
    if (row.transaction) {
      const txnId = row.item.ticket.relatedTransactionId;
      const fresh = txnId ? refreshed[txnId] : undefined;
      context[row.item.ticket.id] = {
        shipmentStatus: fresh?.shipmentStatus ?? row.transaction.shipmentStatus,
        paymentStatus: fresh?.paymentStatus ?? row.transaction.paymentStatus,
        stale: fresh ? false : row.transaction.stale,
      };
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{list.title}</h2>
          <p className="text-sm text-muted-foreground">{list.description}</p>
        </div>
        <Link to={list.to} className="text-sm font-medium text-accent-brand hover:underline">
          View all
        </Link>
      </div>
      <TicketTable items={items} context={context} />
    </section>
  );
}

// ── KB editor ────────────────────────────────────────────────────────────────

function KbOverviewBody({ data }: { data: KbOverview }) {
  return (
    <>
      <CounterGrid counters={data.counters} />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Drafts awaiting publish</h2>
            <p className="text-sm text-muted-foreground">Articles you have started but not yet published.</p>
          </div>
          <Link to="/admin/kb/new" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <IconPlus size={16} className="mr-1" />
            New article
          </Link>
        </div>

        {data.drafts.length === 0 ? (
          <EmptyState title="No drafts">Everything you have written is published.</EmptyState>
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-2 p-4">
              {data.drafts.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2 last:border-0 last:pb-0">
                  <div>
                    <Link to={`/admin/kb/${a.id}`} className="font-medium text-accent-brand hover:underline">
                      {a.title}
                    </Link>
                    <p className="text-xs text-muted-foreground">Updated {formatDate(a.updatedAt)}</p>
                  </div>
                  <Badge variant={a.visibility === 'internal' ? 'outline' : 'info'}>
                    {a.visibility === 'internal' ? 'Internal' : 'Public'}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </section>
    </>
  );
}

// ── Requester ────────────────────────────────────────────────────────────────

function RequesterOverviewBody({ data }: { data: RequesterOverview }) {
  if (data.tickets.length === 0) {
    return (
      <EmptyState
        title="You have no tickets"
        action={
          <Link to="/contact" className={buttonVariants({ variant: 'default', size: 'sm' })}>
            Submit a ticket
          </Link>
        }
      >
        When you raise a concern with GGX support, it will show up here.
      </EmptyState>
    );
  }

  return (
    <>
      <CounterGrid counters={data.counters} />

      {data.awaitingReply.length > 0 && (
        <Alert variant="warning" title="Waiting on you">
          {data.awaitingReply.length === 1 ? 'One ticket needs' : `${data.awaitingReply.length} tickets need`}{' '}
          your reply before support can continue.
        </Alert>
      )}

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold text-foreground">Your tickets</h2>
          <Link to="/contact" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
            <IconPlus size={16} className="mr-1" />
            Submit a ticket
          </Link>
        </div>
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            {data.tickets.map((t) => (
              <RequesterTicketRow key={t.ticket.id} summary={t} />
            ))}
          </CardContent>
        </Card>
      </section>
    </>
  );
}

/**
 * A requester's own ticket. It opens through the secure link (`/t/:token`) — the
 * reference alone never grants access (product rule #6) — and shows none of the
 * agent-side context: no assignee, no team routing, no internal notes.
 */
function RequesterTicketRow({ summary }: { summary: RequesterTicketSummary }) {
  const { ticket, categoryName, trackingNumber, accessToken } = summary;

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3 last:border-0 last:pb-0">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          {accessToken ? (
            <Link to={`/t/${accessToken}`} className="font-medium text-accent-brand hover:underline">
              {ticket.reference}
            </Link>
          ) : (
            <span className="font-medium text-muted-foreground">{ticket.reference}</span>
          )}
          <StatusChip status={ticket.status} holdReason={ticket.holdReason} />
        </div>
        <p className="truncate text-sm text-foreground">{ticket.subject}</p>
        <p className="text-xs text-muted-foreground">
          {/* The tracking number is the thing a customer actually recognizes. */}
          {trackingNumber && <span className="font-mono">{trackingNumber}</span>}
          {trackingNumber && ' · '}
          {categoryName} · Updated {formatDate(ticket.updatedAt)}
        </p>
      </div>
      {accessToken && (
        <Link to={`/t/${accessToken}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          {ticket.status === 'on_hold' && ticket.holdReason === 'waiting_requester' ? 'Reply' : 'View'}
        </Link>
      )}
    </div>
  );
}
