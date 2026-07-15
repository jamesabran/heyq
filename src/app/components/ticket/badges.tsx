import {
  IconAlertTriangle,
  IconArrowBigUpLine,
  IconCircleCheck,
  IconClockExclamation,
  IconPlayerPause,
} from '@tabler/icons-react';
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
 * A row carries status, priority, and SLA at once. Each dimension gets a
 * distinct visual language so they scan independently rather than competing:
 *
 *   Status   — a fixed-width capsule per status (never colour-only — the label
 *              is always present).
 *   Priority — a small colour indicator + text, never a filled pill.
 *   SLA      — a coloured icon + text, with the remaining/overdue time shown
 *              for On track / At risk / Breached.
 *
 * Colour is never the only signal — every state keeps its written label — and
 * none of these use the brand colour, so status/priority/SLA read the same in
 * every theme.
 */

const SLA_LABELS: Record<SlaState, string> = {
  on_track: 'On track',
  at_risk: 'At risk',
  breached: 'Breached',
  met: 'Met',
  paused: 'Paused',
};

const SEVERITY_ORDER: SlaState[] = ['breached', 'at_risk', 'paused', 'on_track', 'met'];

/** The more severe of the two SLA targets (for compact list display). */
export function worstSlaTarget(sla: SlaSummary): SlaTargetSummary {
  return [sla.firstResponse, sla.resolution].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a.state) - SEVERITY_ORDER.indexOf(b.state),
  )[0];
}

/** The most severe of the two SLA targets (for compact list display). */
export function worstSlaState(sla: SlaSummary): SlaState {
  return worstSlaTarget(sla).state;
}

/** "2h 14m left" / "-34m" against the simulated clock. */
function formatSlaTime(dueAt: string, nowMs: number): string {
  const diffMs = new Date(dueAt).getTime() - nowMs;
  const totalMinutes = Math.round(Math.abs(diffMs) / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const compact = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  return diffMs >= 0 ? `${compact} left` : `-${compact}`;
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

const SLA_ICON_META: Record<SlaState, { icon: typeof IconCircleCheck; className: string }> = {
  on_track: { icon: IconCircleCheck, className: 'text-green-600 dark:text-green-400' },
  at_risk: { icon: IconClockExclamation, className: 'text-amber-700 dark:text-amber-400' },
  breached: { icon: IconAlertTriangle, className: 'text-destructive' },
  met: { icon: IconCircleCheck, className: 'text-green-600 dark:text-green-400' },
  paused: { icon: IconPlayerPause, className: 'text-muted-foreground' },
};

/** Only these states carry a countdown/overdue time; Met and Paused are just labels. */
const SLA_STATES_WITH_TIME: SlaState[] = ['on_track', 'at_risk', 'breached'];

/**
 * Compact worst-case SLA for a list row: a coloured icon, the label, and — for
 * On track / At risk / Breached — the remaining or overdue time against the
 * simulated clock. Met and Paused are real internal states an agent isn't
 * scanning for, so they stay quiet (muted icon, no time).
 */
export function SlaSummaryBadge({ sla, now }: { sla: SlaSummary; now: number }) {
  const target = worstSlaTarget(sla);
  const { icon: Icon, className } = SLA_ICON_META[target.state];
  const time = target.dueAt && SLA_STATES_WITH_TIME.includes(target.state)
    ? formatSlaTime(target.dueAt, now)
    : undefined;

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-sm', className)}>
      <Icon size={14} aria-hidden="true" className="shrink-0" />
      <span className="flex flex-col leading-tight">
        <span className={time ? undefined : 'text-muted-foreground'}>{SLA_LABELS[target.state]}</span>
        {time && <span className="text-xs">{time}</span>}
      </span>
    </span>
  );
}

const PRIORITY_META: Record<TicketPriority, { dotClassName: string; label: string }> = {
  urgent: { dotClassName: 'bg-red-500', label: 'Urgent' },
  high: { dotClassName: 'bg-amber-500', label: 'High' },
  normal: { dotClassName: 'bg-gray-400 dark:bg-gray-500', label: 'Normal' },
};

/**
 * Priority as a compact colour indicator + label — never a filled pill, so it
 * doesn't compete with status for a row's attention.
 */
export function PriorityBadge({ priority }: { priority: TicketPriority }) {
  const meta = PRIORITY_META[priority];
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-foreground">
      <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-sm', meta.dotClassName)} />
      {meta.label}
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
