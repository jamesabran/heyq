import { Link } from 'react-router';
import {
  CONCERN_TYPE_LABELS,
  type PaymentStatus,
  type ShipmentStatus,
  type TicketListItem,
} from '../../models/ticket';
import { simulatedNowMs } from '../../lib/clock';
import { cn, formatDateTime, formatRelativeTime } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import { StatusChip } from './StatusChip';
import {
  ConcernTypeBadge,
  EscalationIndicator,
  PaymentStatusBadge,
  PriorityBadge,
  ShipmentStatusBadge,
  SlaSummaryBadge,
} from './badges';

/**
 * GGX transaction context for a row, keyed by ticket id. Supplied only by the
 * Overview's attention lists (M19), where an agent triages without opening the
 * ticket; the queues leave it out and the shipment/payment columns collapse.
 */
export interface RowTransactionContext {
  shipmentStatus: ShipmentStatus;
  paymentStatus?: PaymentStatus;
  stale: boolean;
}

/**
 * The single ticket table, used by every queue, saved view, search result, and the
 * Overview's attention lists — so status, priority, SLA, tracking number, concern
 * type, and escalation are rendered identically everywhere.
 *
 * Responsive strategy: shed lower-priority columns rather than squeezing all of
 * them. Below `xl` the transaction columns go; below `lg` Requester and Team go;
 * below `md` Concern Type, Tracking, and Priority go — each folding into the
 * Subject cell instead of disappearing, so nothing is actually lost.
 */
export function TicketTable({
  items,
  context,
  emptyLabel = 'No tickets match this view.',
}: {
  items: TicketListItem[];
  context?: Record<string, RowTransactionContext>;
  emptyLabel?: string;
}) {
  const showTransaction = context !== undefined;
  const now = simulatedNowMs();

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card px-6 py-12 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-auto rounded-xl border border-border">
      {/* The min-width tracks the columns that are actually rendered: below `md`
          only five survive, so forcing the desktop 820px there would make a phone
          scroll sideways for columns that aren't even on screen. */}
      <table className="w-full min-w-[460px] border-collapse text-sm md:min-w-[820px]">
        {/* Sticky header — long queues stay readable while scrolling. */}
        <thead className="sticky top-0 z-10 bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground shadow-[inset_0_-1px_0_var(--color-border)]">
          <tr>
            <th scope="col" className="px-3 py-2.5 font-medium">Reference</th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Tracking</th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Concern Type</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Subject</th>
            {showTransaction && (
              <th scope="col" className="hidden px-3 py-2.5 font-medium xl:table-cell">Shipment</th>
            )}
            <th scope="col" className="hidden px-3 py-2.5 font-medium lg:table-cell">Requester</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Status</th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium md:table-cell">Priority</th>
            <th scope="col" className="px-3 py-2.5 font-medium">SLA</th>
            <th scope="col" className="hidden px-3 py-2.5 font-medium lg:table-cell">Team</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Updated</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <TicketRow
              key={item.ticket.id}
              item={item}
              now={now}
              transaction={context?.[item.ticket.id]}
              showTransaction={showTransaction}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TicketRow({
  item,
  now,
  transaction,
  showTransaction,
}: {
  item: TicketListItem;
  now: number;
  transaction?: RowTransactionContext;
  showTransaction: boolean;
}) {
  const { ticket, requesterName, teamName, assigneeName, trackingNumber, sla } = item;

  return (
    // The row is interactive as a whole (hover + keyboard focus travel through the
    // reference link), but it is never tinted by state — an urgent ticket is loud
    // through its badges, not by turning the row red.
    <tr className="border-b border-border transition-colors last:border-0 hover:bg-accent/50 focus-within:bg-accent/50">
      <td className="px-3 py-2.5 align-top">
        <div className="flex flex-col gap-0.5">
          <Link
            to={`/app/tickets/${ticket.id}`}
            className="font-medium text-accent-brand hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background"
          >
            {ticket.reference}
          </Link>
          <EscalationIndicator state={ticket.escalationState} />
        </div>
      </td>

      <td className="hidden whitespace-nowrap px-3 py-2.5 align-top md:table-cell">
        <TrackingNumber value={trackingNumber} />
      </td>

      <td className="hidden px-3 py-2.5 align-top md:table-cell">
        <ConcernTypeBadge concernType={ticket.concernType} />
      </td>

      <td className="max-w-[260px] px-3 py-2.5 align-top text-foreground">
        <span className="block truncate" title={ticket.subject}>{ticket.subject}</span>
        {/* Below md the shed columns fold into the subject rather than vanishing. */}
        <span className="mt-0.5 block truncate text-xs text-muted-foreground md:hidden">
          {[
            ticket.concernType ? CONCERN_TYPE_LABELS[ticket.concernType] : undefined,
            trackingNumber,
            ticket.priority !== 'normal' ? `${ticket.priority === 'urgent' ? 'Urgent' : 'High'} priority` : undefined,
          ]
            .filter(Boolean)
            .join(' · ')}
        </span>
      </td>

      {showTransaction && (
        <td className="hidden px-3 py-2.5 align-top xl:table-cell">
          {transaction ? (
            <div className="flex flex-wrap items-center gap-1">
              <ShipmentStatusBadge status={transaction.shipmentStatus} />
              {transaction.paymentStatus && <PaymentStatusBadge status={transaction.paymentStatus} />}
              {transaction.stale && (
                <Badge variant="outline" title="Transaction data is past its freshness window">
                  Stale
                </Badge>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </td>
      )}

      <td className="hidden px-3 py-2.5 align-top text-muted-foreground lg:table-cell">{requesterName}</td>

      <td className="px-3 py-2.5 align-top">
        <StatusChip status={ticket.status} holdReason={ticket.holdReason} />
      </td>

      <td className="hidden px-3 py-2.5 align-top md:table-cell">
        <PriorityBadge priority={ticket.priority} />
      </td>

      <td className="px-3 py-2.5 align-top">
        <SlaSummaryBadge sla={sla} />
      </td>

      <td className="hidden px-3 py-2.5 align-top text-muted-foreground lg:table-cell">
        <span className="block text-foreground">{teamName}</span>
        <span className="block text-xs">{assigneeName ?? 'Unassigned'}</span>
      </td>

      <td className="whitespace-nowrap px-3 py-2.5 align-top text-muted-foreground">
        {/* Relative for scanning; the exact time stays in the tooltip + a11y label. */}
        <time dateTime={ticket.updatedAt} title={formatDateTime(ticket.updatedAt)}>
          {formatRelativeTime(ticket.updatedAt, now)}
        </time>
      </td>
    </tr>
  );
}

/** A GGX tracking number, or an em dash for a ticket with no shipment. */
function TrackingNumber({ value, className }: { value?: string; className?: string }) {
  if (!value) return <span className="text-muted-foreground">—</span>;
  return <span className={cn('font-mono text-xs text-foreground', className)}>{value}</span>;
}
