import { Badge } from '../ui/Badge';
import {
  HOLD_REASON_LABELS,
  STATUS_LABELS,
  statusBadgeVariant,
  type HoldReason,
  type TicketStatus,
} from '../../models/ticket';

/**
 * Ticket status as a subtle chip. Status is independent of escalation state.
 *
 * An on-hold ticket names what it is blocked on: the reason is appended to the
 * accessible label (and the tooltip) rather than shown as a second pill, so the
 * row keeps one status signal instead of two competing ones.
 */
export function StatusChip({ status, holdReason }: { status: TicketStatus; holdReason?: HoldReason }) {
  const label = STATUS_LABELS[status];
  const reason = status === 'on_hold' && holdReason ? HOLD_REASON_LABELS[holdReason] : undefined;

  return (
    <Badge variant={statusBadgeVariant(status)} title={reason ? `${label} — ${reason}` : label}>
      {label}
      {reason && <span className="sr-only"> — {reason}</span>}
    </Badge>
  );
}
