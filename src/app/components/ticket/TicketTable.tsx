import { Link } from 'react-router';
import { IconArrowUp } from '@tabler/icons-react';
import type { TicketListItem } from '../../models/ticket';
import { formatDate } from '../../lib/utils';
import { StatusChip } from './StatusChip';
import { PriorityBadge, SlaSummaryBadge } from './badges';

/** Dense ticket list table. Rows link to the agent ticket detail. */
export function TicketTable({ items }: { items: TicketListItem[] }) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        No tickets match this view.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Reference</th>
            <th className="px-3 py-2 font-medium">Subject</th>
            <th className="px-3 py-2 font-medium">Requester</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">SLA</th>
            <th className="px-3 py-2 font-medium">Team</th>
            <th className="px-3 py-2 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ ticket, requesterName, teamName, assigneeName, sla }) => (
            <tr key={ticket.id} className="border-b border-border last:border-0 hover:bg-accent/50">
              <td className="px-3 py-2">
                <Link
                  to={`/app/tickets/${ticket.id}`}
                  className="font-medium text-primary hover:underline"
                >
                  {ticket.reference}
                </Link>
                {ticket.escalationState !== 'none' && (
                  <IconArrowUp size={13} className="ml-1 inline text-destructive" aria-label="Escalated" />
                )}
              </td>
              <td className="max-w-[260px] truncate px-3 py-2 text-foreground">{ticket.subject}</td>
              <td className="px-3 py-2 text-muted-foreground">{requesterName}</td>
              <td className="px-3 py-2"><StatusChip status={ticket.status} /></td>
              <td className="px-3 py-2"><PriorityBadge priority={ticket.priority} /></td>
              <td className="px-3 py-2"><SlaSummaryBadge sla={sla} /></td>
              <td className="px-3 py-2 text-muted-foreground">
                {teamName}
                {assigneeName ? <span className="block text-xs">→ {assigneeName}</span> : null}
              </td>
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(ticket.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
