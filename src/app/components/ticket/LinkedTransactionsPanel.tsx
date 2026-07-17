import { useEffect, useState } from 'react';
import { IconChevronRight, IconX } from '@tabler/icons-react';
import { SOURCE_SYSTEM_LABELS, type LinkedOrder } from '../../models/ticket';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { ShipmentStatusBadge } from './badges';
import { LinkedOrderPanel } from './LinkedOrderPanel';

/**
 * Linked Business+ transactions in the agent detail view (M26).
 *
 * A ticket may reference MANY transactions. This panel stays COMPACT — it never
 * stacks full transaction cards in the side column. It shows the total count, up
 * to three compact rows (tracking · shipment status · origin → destination), and
 * a "View all" affordance beyond that. Opening one row surfaces the existing full
 * `LinkedOrderPanel` (details + live-status check) in a modal, so an agent inspects
 * one transaction at a time WITHOUT leaving the ticket.
 *
 * Order is meaningful: the first entry is the primary/originating transaction (the
 * one a Transaction Details report started from) and is shown first.
 */
const COMPACT_LIMIT = 3;

export function LinkedTransactionsPanel({ transactions }: { transactions: LinkedOrder[] }) {
  const [expanded, setExpanded] = useState(false);
  const [active, setActive] = useState<LinkedOrder | null>(null);

  if (transactions.length === 0) return null;

  const hasMore = transactions.length > COMPACT_LIMIT;
  const shown = expanded ? transactions : transactions.slice(0, COMPACT_LIMIT);

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {SOURCE_SYSTEM_LABELS.ggx_business_plus} Transactions ({transactions.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1.5">
        <ul className="flex flex-col gap-1.5">
          {shown.map((order) => (
            <li key={order.externalOrderId}>
              <TransactionRow order={order} onOpen={() => setActive(order)} />
            </li>
          ))}
        </ul>

        {hasMore && (
          <Button
            size="sm"
            variant="ghost"
            className="self-start"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'Show fewer' : `View all transactions (${transactions.length})`}
          </Button>
        )}
      </CardContent>

      {active && <TransactionModal order={active} onClose={() => setActive(null)} />}
    </Card>
  );
}

/** One compact, clickable row: tracking · status · origin → destination. */
function TransactionRow({ order, onOpen }: { order: LinkedOrder; onOpen: () => void }) {
  const route = order.snapshot.route ?? order.snapshot.destination ?? '—';
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-center gap-2 rounded-md border border-border px-2 py-1.5 text-left transition-colors hover:bg-accent/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs font-medium text-foreground">{order.trackingNumber}</span>
          <ShipmentStatusBadge status={order.snapshot.shipmentStatus} />
        </span>
        <span className="truncate text-xs text-muted-foreground" title={route}>{route}</span>
      </span>
      <IconChevronRight size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

/**
 * Lightweight modal hosting the full single-transaction panel. Closes on backdrop
 * click and Escape; the agent never leaves the ticket page.
 */
function TransactionModal({ order, onClose }: { order: LinkedOrder; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-label={`Transaction ${order.trackingNumber}`}
      onClick={onClose}
    >
      <div className="w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex justify-end">
          <Button size="sm" variant="outline" onClick={onClose} aria-label="Close">
            <IconX size={15} /> Close
          </Button>
        </div>
        <LinkedOrderPanel order={order} />
      </div>
    </div>
  );
}
