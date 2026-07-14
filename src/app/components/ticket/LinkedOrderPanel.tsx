import { useState } from 'react';
import { IconRefresh } from '@tabler/icons-react';
import { getOrderProvider, type OrderLookupResult } from '../../services/orderProvider';
import { SOURCE_SYSTEM_LABELS, type LinkedOrder } from '../../models/ticket';
import { formatDate, formatDateTime } from '../../lib/utils';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { ShipmentStatusBadge } from './badges';

/**
 * Linked Business+ order context in the agent detail view (M22).
 *
 * SNAPSHOT-FIRST: everything shown by default was captured at submission and
 * lives on the ticket, so this panel works even when Business+ is down or the
 * order was deleted upstream. "Check live status" fetches the current record
 * through the support-scoped provider read — display only. A live shipment
 * change NEVER touches the HeyQ ticket status (they are separate dimensions).
 */
export function LinkedOrderPanel({ order }: { order: LinkedOrder }) {
  const [live, setLive] = useState<OrderLookupResult | null>(null);
  const [checking, setChecking] = useState(false);

  async function checkLive() {
    setChecking(true);
    try {
      setLive(await getOrderProvider().getOrderForSupport(order.externalOrderId));
    } finally {
      setChecking(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{SOURCE_SYSTEM_LABELS.ggx_business_plus} Order</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm">
        <Row label="Order ID" value={<span className="font-mono text-xs">{order.externalOrderId}</span>} />
        <Row label="Tracking" value={<span className="font-mono text-xs">{order.trackingNumber}</span>} />
        <Row
          label="Shipment"
          value={
            <span className="inline-flex flex-wrap items-center gap-1.5">
              <ShipmentStatusBadge status={order.snapshot.shipmentStatus} />
              <span
                className="text-xs text-muted-foreground"
                title={formatDateTime(order.capturedAt)}
              >
                as of {formatDate(order.capturedAt)}
              </span>
            </span>
          }
        />
        <Row label="Booked" value={formatDate(order.snapshot.bookingDate)} />
        <Row label="Sender" value={order.snapshot.senderSummary} />
        <Row label="Recipient" value={order.snapshot.recipientSummary} />
        {order.snapshot.destination && <Row label="Destination" value={order.snapshot.destination} />}

        <div className="flex flex-col gap-2 border-t border-border pt-3">
          <Button size="sm" variant="outline" onClick={checkLive} disabled={checking}>
            <IconRefresh size={15} className="mr-1" />
            {checking ? 'Checking…' : 'Check live status'}
          </Button>

          {live?.status === 'ok' && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Live:</span>
              <ShipmentStatusBadge status={live.order.shipmentStatus} />
              {live.order.shipmentStatus !== order.snapshot.shipmentStatus && (
                <span className="text-xs text-muted-foreground">
                  changed since submission — the ticket status is unaffected
                </span>
              )}
            </div>
          )}
          {live?.status === 'unavailable' && (
            <Alert variant="warning">
              GGX Business+ is unreachable. The details above are the snapshot saved with the ticket.
            </Alert>
          )}
          {live?.status === 'not_found' && (
            <Alert variant="warning">
              This order no longer exists in GGX Business+. The saved snapshot above remains the
              record of what was reported.
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right text-foreground">{value}</span>
    </div>
  );
}
