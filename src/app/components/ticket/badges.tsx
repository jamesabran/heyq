import { IconArrowBigUpLine } from '@tabler/icons-react';
import { Badge, type BadgeProps } from '../ui/Badge';
import { cn } from '../../lib/utils';
import {
  CONCERN_TYPE_LABELS,
  ESCALATION_REASON_LABELS,
  PAYMENT_STATUS_LABELS,
  REMITTANCE_STATUS_LABELS,
  SHIPMENT_STATUS_LABELS,
  type ConcernType,
  type EscalationReason,
  type EscalationState,
  type PaymentStatus,
  type RemittanceStatus,
  type ShipmentStatus,
  type SlaState,
  type SlaSummary,
  type SlaTargetSummary,
  type TicketPriority,
} from '../../models/ticket';

type Variant = NonNullable<BadgeProps['variant']>;

/**
 * BADGE HIERARCHY (docs/design-system-strategy.md).
 *
 * A row carries status, priority, and SLA at once. If all three are strong pills
 * the eye can't tell which one is asking for action, so only the states that
 * actually need attention are loud:
 *
 *   Status   — always a subtle chip (semantic, low-saturation).
 *   Priority — Normal is plain text, High is amber text, only Urgent is a red pill.
 *   SLA      — On track is muted text, At risk is amber, only Breached is red.
 *
 * The result: an ordinary row is quiet, and urgent / at-risk / breached / escalated
 * rows stand out on their own. Colour is never the only signal — every state keeps
 * its written label.
 */

const SLA_LABELS: Record<SlaState, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  breached: 'Breached',
  met: 'Met',
  paused: 'Paused',
};

const SEVERITY_ORDER: SlaState[] = ['breached', 'at_risk', 'paused', 'on_track', 'met'];

/** The most severe of the two SLA targets (for compact list display). */
export function worstSlaState(sla: SlaSummary): SlaState {
  return [sla.firstResponse.state, sla.resolution.state].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b),
  )[0];
}

/**
 * A single SLA target, on the detail pane where both targets are shown side by
 * side and the internal states (met, paused) are genuinely useful.
 */
export function SlaBadge({ target, label }: { target: SlaTargetSummary; label?: string }) {
  const variant: Variant =
    target.state === 'breached'
      ? 'destructive'
      : target.state === 'at_risk'
        ? 'warning'
        : target.state === 'met'
          ? 'success'
          : 'outline';

  return (
    <Badge variant={variant}>
      {label ? `${label}: ` : ''}
      {SLA_LABELS[target.state]}
    </Badge>
  );
}

/**
 * Compact worst-case SLA for a list row. Only At risk and Breached earn a pill —
 * "met" and "paused" are real internal states but they are not what an agent is
 * scanning for, so they render as quiet text.
 */
export function SlaSummaryBadge({ sla }: { sla: SlaSummary }) {
  const worst = worstSlaState(sla);

  if (worst === 'breached') return <Badge variant="destructive">Breached</Badge>;
  if (worst === 'at_risk') return <Badge variant="warning">At risk</Badge>;

  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn(
          'size-1.5 rounded-full',
          worst === 'paused' ? 'bg-muted-foreground/50' : 'bg-green-600 dark:bg-green-400',
        )}
      />
      {SLA_LABELS[worst]}
    </span>
  );
}

const PRIORITY_LABELS: Record<TicketPriority, string> = {
  urgent: 'Urgent',
  high: 'High',
  normal: 'Normal',
};

/** Only Urgent is loud; High is restrained amber; Normal is plain text. */
export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  if (priority === 'urgent') return <Badge variant="destructive">Urgent</Badge>;

  return (
    <span
      className={cn(
        'text-sm',
        priority === 'high' ? 'font-medium text-amber-700 dark:text-amber-400' : 'text-muted-foreground',
      )}
    >
      {PRIORITY_LABELS[priority]}
    </span>
  );
}

/**
 * Escalation — a SEPARATE dimension from status (product rule #2), so it gets its
 * own indicator rather than a status colour. Never a bare arrow: the icon is
 * paired with a written label, a tooltip, and an accessible name.
 */
export function EscalationIndicator({
  state,
  reason,
  className,
}: {
  state: EscalationState;
  reason?: EscalationReason;
  className?: string;
}) {
  if (state === 'none') return null;

  const returned = state === 'returned_to_l1';
  const label = returned ? 'Returned to L1' : 'Escalated';
  const detail = !returned && reason ? `${label} — ${ESCALATION_REASON_LABELS[reason]}` : label;

  return (
    <span
      title={detail}
      aria-label={detail}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium',
        returned ? 'text-muted-foreground' : 'text-amber-700 dark:text-amber-400',
        className,
      )}
    >
      <IconArrowBigUpLine size={13} aria-hidden="true" className={returned ? 'rotate-180' : undefined} />
      {label}
    </span>
  );
}

/**
 * Concern Type chip (M15) — a NEUTRAL descriptor, deliberately not colour-coded
 * with red so it never competes with status/SLA/priority signals. Renders "—"
 * when a ticket has no concern type yet.
 */
export function ConcernTypeBadge({ concernType }: { concernType?: ConcernType }) {
  if (!concernType) return <span className="text-muted-foreground">—</span>;
  return <Badge variant="outline">{CONCERN_TYPE_LABELS[concernType]}</Badge>;
}

// ── Transaction status badges (M13) ──────────────────────────────────────────
// Shipment, payment, and remittance are INDEPENDENT dimensions. Colours are
// spread across the palette (not all red) so a glance distinguishes them; strong
// red (destructive) is reserved for genuine failures.

const SHIPMENT_META: Record<ShipmentStatus, Variant> = {
  booked: 'info',
  picked_up: 'info',
  in_transit: 'info',
  out_for_delivery: 'info',
  delivered: 'success',
  failed_delivery: 'destructive',
  returned: 'warning',
  cancelled: 'default',
  on_hold: 'warning',
};

const PAYMENT_META: Record<PaymentStatus, Variant> = {
  paid: 'success',
  unpaid: 'warning',
  refunded: 'info',
  failed: 'destructive',
};

const REMITTANCE_META: Record<RemittanceStatus, Variant> = {
  remitted: 'success',
  pending: 'warning',
  on_hold: 'warning',
  not_applicable: 'outline',
};

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  return <Badge variant={SHIPMENT_META[status]}>{SHIPMENT_STATUS_LABELS[status]}</Badge>;
}

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return <Badge variant={PAYMENT_META[status]}>{PAYMENT_STATUS_LABELS[status]}</Badge>;
}

export function RemittanceStatusBadge({ status }: { status: RemittanceStatus }) {
  return <Badge variant={REMITTANCE_META[status]}>{REMITTANCE_STATUS_LABELS[status]}</Badge>;
}
