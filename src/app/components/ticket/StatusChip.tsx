import { Badge } from '../ui/Badge';
import { STATUS_LABELS, statusBadgeVariant, type TicketStatus } from '../../models/ticket';

/** Ticket status as a colored chip. Status is independent of escalation state. */
export function StatusChip({ status }: { status: TicketStatus }) {
  return <Badge variant={statusBadgeVariant(status)}>{STATUS_LABELS[status]}</Badge>;
}
