import { useCallback, useState } from 'react';
import { IconRefresh } from '@tabler/icons-react';
import {
  getTransactionForTicket,
  lookupByTracking,
  type TrackingLookupResult,
} from '../../services/transactionService';
import { linkTransaction } from '../../services/ticketService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import type { RelatedTransaction } from '../../models/ticket';
import { formatDateTime } from '../../lib/utils';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import {
  PaymentStatusBadge,
  RemittanceStatusBadge,
  ShipmentStatusBadge,
} from './badges';

/**
 * GGX transaction context (M13). Renders the transaction linked to a ticket
 * inline so agents rarely need to open a separate GGX system. Handles every
 * state: loading, found, stale, unavailable, permission/ownership mismatch, and
 * (when nothing is linked) a manual tracking-number lookup that resolves
 * invalid / multiple / found. The three statuses shown here (shipment, payment,
 * remittance) are independent of the ticket's workflow status.
 */
export function TransactionPanel({
  ticketId,
  relatedTransactionId,
  viewerTeamId,
  onChanged,
}: {
  ticketId: string;
  relatedTransactionId?: string;
  viewerTeamId?: string;
  onChanged: () => void;
}) {
  const result = useQuery(
    useCallback(
      () => getTransactionForTicket(relatedTransactionId, viewerTeamId),
      [relatedTransactionId, viewerTeamId],
    ),
    [relatedTransactionId, viewerTeamId],
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>GGX Transaction</CardTitle>
        {relatedTransactionId && (
          <button
            type="button"
            onClick={result.refetch}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Refresh transaction data"
            disabled={result.loading}
          >
            <IconRefresh size={13} className={result.loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        )}
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        {result.loading ? (
          <p className="text-muted-foreground">Loading transaction…</p>
        ) : result.error ? (
          <Alert variant="destructive">Couldn&apos;t load transaction data.</Alert>
        ) : !result.data || result.data.status === 'none' ? (
          <TransactionLookup ticketId={ticketId} onLinked={onChanged} />
        ) : result.data.status === 'unavailable' ? (
          <Alert variant="warning" title="Transaction unavailable">
            The linked transaction could not be retrieved from GGX right now. Try refreshing shortly.
          </Alert>
        ) : result.data.status === 'permission_denied' ? (
          <Alert variant="warning" title="No access to this transaction">
            This transaction belongs to another team. Ask the owning team or an admin to view its details.
          </Alert>
        ) : (
          <TransactionDetails transaction={result.data.transaction} stale={result.data.stale} />
        )}
      </CardContent>
    </Card>
  );
}

function fmtMoney(amount: number | undefined, currency = 'PHP'): string {
  if (amount === undefined) return '—';
  const symbol = currency === 'PHP' ? '₱' : '';
  return `${symbol}${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function TransactionDetails({ transaction: t, stale }: { transaction: RelatedTransaction; stale: boolean }) {
  const hasCod = t.codAmount !== undefined || (t.remittanceStatus && t.remittanceStatus !== 'not_applicable');
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-foreground">{t.trackingNumber}</span>
        {stale && <Badge variant="warning">Stale data</Badge>}
      </div>

      {/* Three independent statuses. */}
      <div className="flex flex-col gap-2">
        <StatusRow label="Shipment"><ShipmentStatusBadge status={t.shipmentStatus} /></StatusRow>
        {t.paymentStatus && <StatusRow label="Payment"><PaymentStatusBadge status={t.paymentStatus} /></StatusRow>}
        {t.remittanceStatus && <StatusRow label="Remittance"><RemittanceStatusBadge status={t.remittanceStatus} /></StatusRow>}
      </div>

      <Divider />
      <InfoRow label="Route" value={t.origin && t.destination ? `${t.origin} → ${t.destination}` : (t.destination ?? '—')} />
      <InfoRow label="Sender" value={t.senderMasked ?? '—'} />
      <InfoRow label="Recipient" value={t.recipientMasked ?? '—'} />
      {t.orderId && <InfoRow label="Order" value={t.orderId} />}

      <Divider />
      {t.bookingDate && <InfoRow label="Booked" value={formatDateTime(t.bookingDate)} />}
      {t.pickupDate && <InfoRow label="Picked up" value={formatDateTime(t.pickupDate)} />}
      {t.deliveryDate && <InfoRow label="Delivered" value={formatDateTime(t.deliveryDate)} />}
      {t.latestMovementAt && <InfoRow label="Latest movement" value={formatDateTime(t.latestMovementAt)} />}

      <Divider />
      <InfoRow label="Shipping fee" value={fmtMoney(t.shippingFee, t.currency)} />
      {t.charges?.map((c, i) => <InfoRow key={i} label={c.label} value={fmtMoney(c.amount, t.currency)} />)}
      {t.paymentMethod && <InfoRow label="Payment method" value={t.paymentMethod} />}
      {hasCod && <InfoRow label="COD amount" value={fmtMoney(t.codAmount, t.currency)} />}

      {t.exceptions && t.exceptions.length > 0 && (
        <>
          <Divider />
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Exceptions</span>
            {t.exceptions.map((e, i) => (
              <div key={i} className="rounded-md border border-border bg-muted/40 px-2 py-1.5">
                <p className="text-foreground">{e.reason ?? e.type}</p>
                <p className="text-xs text-muted-foreground">{e.type.replace(/_/g, ' ')} · {formatDateTime(e.at)}</p>
              </div>
            ))}
          </div>
        </>
      )}

      <Divider />
      <p className="text-xs text-muted-foreground">
        Source: {t.dataSource} · Updated {formatDateTime(t.lastUpdatedAt)}
      </p>
    </div>
  );
}

/** Manual tracking-number lookup shown when no transaction is linked. */
function TransactionLookup({ ticketId, onLinked }: { ticketId: string; onLinked: () => void }) {
  const [query, setQuery] = useState('');
  const [outcome, setOutcome] = useState<TrackingLookupResult | null>(null);
  const lookup = useMutation(lookupByTracking);
  const link = useMutation(linkTransaction);

  async function onSearch() {
    if (!query.trim()) return;
    const res = await lookup.mutate(query);
    setOutcome(res);
  }

  async function onLink(transactionId: string) {
    await link.mutate(ticketId, transactionId);
    onLinked();
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-muted-foreground">No transaction linked. Search a tracking number to attach one.</p>
      <div className="flex gap-2">
        <Input
          aria-label="Tracking number"
          placeholder="e.g. 1GGT-AYT1-TKK3"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSearch(); } }}
        />
        <Button size="sm" variant="outline" onClick={onSearch} disabled={lookup.loading || !query.trim()}>
          {lookup.loading ? '…' : 'Search'}
        </Button>
      </div>

      {outcome?.status === 'invalid' && (
        <Alert variant="warning">No transaction matches “{outcome.query}”. Check the tracking number.</Alert>
      )}
      {outcome?.status === 'unavailable' && (
        <Alert variant="warning">Transaction lookup is unavailable right now.</Alert>
      )}
      {outcome?.status === 'multiple' && (
        <div className="flex flex-col gap-1.5">
          <p className="text-xs text-muted-foreground">Multiple matches — pick one:</p>
          {outcome.matches.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => onLink(m.id)}
              disabled={link.loading}
              className="rounded-md border border-border px-2 py-1.5 text-left hover:bg-accent/50"
            >
              <span className="font-mono text-xs text-foreground">{m.trackingNumber}</span>
              <span className="block text-xs text-muted-foreground">{m.destination ?? '—'}</span>
            </button>
          ))}
        </div>
      )}
      {outcome?.status === 'found' && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5">
          <span className="font-mono text-xs text-foreground">{outcome.transaction.trackingNumber}</span>
          <Button size="sm" onClick={() => onLink(outcome.transaction.id)} disabled={link.loading}>
            Link
          </Button>
        </div>
      )}
    </div>
  );
}

function StatusRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  );
}

function Divider() {
  return <hr className="border-border" />;
}
