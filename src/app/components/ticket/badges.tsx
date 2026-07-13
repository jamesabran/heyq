import { Badge, type BadgeProps } from '../ui/Badge';
import type { SlaState, SlaSummary, SlaTargetSummary, TicketPriority } from '../../models/ticket';

type Variant = NonNullable<BadgeProps['variant']>;

const SLA_META: Record<SlaState, { label: string; variant: Variant }> = {
  on_track: { label: 'On track', variant: 'success' },
  at_risk: { label: 'At risk', variant: 'warning' },
  breached: { label: 'Breached', variant: 'destructive' },
  met: { label: 'Met', variant: 'outline' },
  paused: { label: 'Paused', variant: 'info' },
};

const SEVERITY_ORDER: SlaState[] = ['breached', 'at_risk', 'paused', 'on_track', 'met'];

/** The most severe of the two SLA targets (for compact list display). */
export function worstSlaState(sla: SlaSummary): SlaState {
  return [sla.firstResponse.state, sla.resolution.state].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b),
  )[0];
}

/** A single SLA target as a badge, optionally prefixed with a label. */
export function SlaBadge({ target, label }: { target: SlaTargetSummary; label?: string }) {
  const meta = SLA_META[target.state];
  return (
    <Badge variant={meta.variant}>
      {label ? `${label}: ` : ''}
      {meta.label}
    </Badge>
  );
}

/** Compact worst-case SLA badge for list rows. */
export function SlaSummaryBadge({ sla }: { sla: SlaSummary }) {
  const worst = worstSlaState(sla);
  return <Badge variant={SLA_META[worst].variant}>{SLA_META[worst].label}</Badge>;
}

const PRIORITY_META: Record<TicketPriority, { label: string; variant: Variant }> = {
  urgent: { label: 'Urgent', variant: 'destructive' },
  high: { label: 'High', variant: 'warning' },
  normal: { label: 'Normal', variant: 'default' },
  low: { label: 'Low', variant: 'outline' },
};

export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const meta = PRIORITY_META[priority];
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}
