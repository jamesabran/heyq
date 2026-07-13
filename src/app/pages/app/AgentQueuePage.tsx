import { useCallback, useState } from 'react';
import { listTickets, type TicketQueue } from '../../services/ticketService';
import { useQuery } from '../../hooks/useQuery';
import { useIdentity } from '../../contexts/IdentityContext';
import type { TicketStatus } from '../../models/ticket';
import { STATUS_LABELS } from '../../models/ticket';
import { PageHeader } from '../../components/layout/PageHeader';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { TicketTable } from '../../components/ticket/TicketTable';
import { LoadingGrid } from '../../components/help/HelpStates';

const STATUSES: TicketStatus[] = [
  'new', 'open', 'in_progress', 'pending_requester', 'resolved', 'closed', 'reopened',
];

/** Reusable agent queue: header + filters + ticket table, scoped by identity. */
export function AgentQueuePage({
  queue,
  title,
  subtitle,
  showSearch = true,
}: {
  queue: TicketQueue;
  title: string;
  subtitle?: string;
  showSearch?: boolean;
}) {
  const { identity } = useIdentity();
  const [status, setStatus] = useState<'' | TicketStatus>('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<'updated' | 'created' | 'priority'>('updated');

  const tickets = useQuery(
    useCallback(
      () =>
        listTickets({
          queue,
          viewerId: identity.id,
          viewerTeamId: identity.teamId,
          status: status || undefined,
          search: search || undefined,
          sort,
        }),
      [queue, identity.id, identity.teamId, status, search, sort],
    ),
    [queue, identity.id, identity.teamId, status, search, sort],
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="flex flex-wrap items-center gap-3">
        {showSearch && (
          <Input
            type="search"
            aria-label="Search tickets"
            placeholder="Search reference, subject, requester…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
        )}
        <div className="w-40">
          <Select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value as TicketStatus | '')}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
          </Select>
        </div>
        <div className="w-40">
          <Select aria-label="Sort tickets" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
            <option value="updated">Recently updated</option>
            <option value="created">Newest</option>
            <option value="priority">Priority</option>
          </Select>
        </div>
      </div>

      {tickets.loading ? <LoadingGrid count={3} /> : <TicketTable items={tickets.data ?? []} />}
    </div>
  );
}
