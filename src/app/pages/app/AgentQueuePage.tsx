import { useCallback } from 'react';
import { Link, useSearchParams } from 'react-router';
import { IconPlus, IconX } from '@tabler/icons-react';
import { listTickets, type TicketQueue } from '../../services/ticketService';
import { useQuery } from '../../hooks/useQuery';
import { useIdentity } from '../../contexts/IdentityContext';
import type { TicketPriority, TicketStatus } from '../../models/ticket';
import { STATUS_LABELS, TICKET_STATUSES } from '../../models/ticket';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button, buttonVariants } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { TicketTable } from '../../components/ticket/TicketTable';
import { ErrorState, LoadingGrid } from '../../components/help/HelpStates';

const PRIORITIES: TicketPriority[] = ['urgent', 'high', 'normal'];
const PRIORITY_LABELS: Record<TicketPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
};

type Sort = 'updated' | 'created' | 'priority';

/** Reusable agent queue: header + filters + ticket table, scoped by identity. */
export function AgentQueuePage({
  queue,
  title,
  subtitle,
  showSearch = true,
  showNewTicket = true,
}: {
  queue: TicketQueue;
  title: string;
  subtitle?: string;
  showSearch?: boolean;
  /** The "New ticket" action (internal ticket creation, M16) — on by default so
   *  an agent can raise a ticket from whichever queue they happen to be in. */
  showNewTicket?: boolean;
}) {
  const { identity } = useIdentity();

  // Filters live in the URL so a queue view is linkable — the Overview's counters
  // (M19) deep-link straight to the filtered list they count.
  const [params, setParams] = useSearchParams();
  const status = (params.get('status') ?? '') as '' | TicketStatus;
  const priority = (params.get('priority') ?? '') as '' | TicketPriority;
  const search = params.get('q') ?? '';
  const sort = (params.get('sort') ?? 'updated') as Sort;
  // Reopened is a flag, not a status, so it can't live in the status select. It
  // arrives as a link from the Overview and shows as a clearable chip.
  const reopenedOnly = params.get('reopened') === '1';

  const setParam = (key: string, value: string) => {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  };

  const tickets = useQuery(
    useCallback(
      () =>
        listTickets({
          queue,
          viewerId: identity.id,
          viewerTeamId: identity.teamId,
          status: status || undefined,
          priority: priority || undefined,
          reopened: reopenedOnly || undefined,
          search: search || undefined,
          sort,
        }),
      [queue, identity.id, identity.teamId, status, priority, reopenedOnly, search, sort],
    ),
    [queue, identity.id, identity.teamId, status, priority, reopenedOnly, search, sort],
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={title} subtitle={subtitle} />
        {showNewTicket && (
          <Link to="/app/tickets/new" className={buttonVariants({ variant: 'default', size: 'sm' })}>
            <IconPlus size={16} className="mr-1" />
            New ticket
          </Link>
        )}
      </div>

      {/* Search + filters are one visually grouped control bar. */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3">
        {showSearch && (
          <Input
            type="search"
            aria-label="Search tickets"
            placeholder="Search tickets, tracking numbers, subjects, or requesters…"
            value={search}
            onChange={(e) => setParam('q', e.target.value)}
            className="min-w-[16rem] flex-1 sm:max-w-md"
          />
        )}
        <div className="w-40">
          <Select aria-label="Filter by status" value={status} onChange={(e) => setParam('status', e.target.value)}>
            <option value="">All statuses</option>
            {TICKET_STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </Select>
        </div>
        <div className="w-40">
          <Select aria-label="Filter by priority" value={priority} onChange={(e) => setParam('priority', e.target.value)}>
            <option value="">All priorities</option>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </Select>
        </div>
        <div className="w-40">
          <Select aria-label="Sort tickets" value={sort} onChange={(e) => setParam('sort', e.target.value)}>
            <option value="updated">Recently updated</option>
            <option value="created">Newest</option>
            <option value="priority">Priority</option>
          </Select>
        </div>
        {reopenedOnly && (
          <Button variant="outline" size="sm" onClick={() => setParam('reopened', '')}>
            Reopened only
            <IconX size={14} className="ml-1" aria-hidden="true" />
            <span className="sr-only">Clear the reopened filter</span>
          </Button>
        )}
      </div>

      {tickets.error ? (
        <ErrorState onRetry={tickets.refetch} />
      ) : tickets.loading ? (
        <LoadingGrid count={3} />
      ) : (
        <TicketTable items={tickets.data ?? []} />
      )}
    </div>
  );
}
