import { useCallback, useEffect, useRef, useState } from 'react';
import { getOrderProvider, type OrderProviderIdentity } from '../../services/orderProvider';
import { useQuery } from '../../hooks/useQuery';
import { formatDate } from '../../lib/utils';
import { Alert } from '../ui/Alert';
import { Input } from '../ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { ShipmentStatusBadge } from './badges';

/**
 * Authorized-order selection for a Business+ requester (M22). Lists only the
 * orders the provider says this user/org may see; the service re-checks
 * authorization at submission, so this UI is a convenience, not the gate.
 *
 * Linking is always optional — "no order" is the first choice, and if the
 * provider is down the form degrades to exactly that path instead of blocking
 * the requester from getting help.
 */
export function OrderPicker({
  identity,
  orgName,
  selectedOrderId,
  onSelect,
  requestedOrderId,
}: {
  identity: OrderProviderIdentity;
  orgName: string;
  selectedOrderId: string | null;
  onSelect: (externalOrderId: string | null) => void;
  /** Deep-linked order (?order=…) from the Business+ handoff, if any. */
  requestedOrderId?: string;
}) {
  const [search, setSearch] = useState('');
  const orders = useQuery(
    useCallback(
      () => getOrderProvider().listAuthorizedOrders(identity, search || undefined),
      [identity, search],
    ),
    [identity.externalUserId, identity.externalOrgId, search],
  );

  // Honour the handoff deep link once the authorized list arrives: preselect it
  // when it's in scope, and say so plainly when it isn't.
  const appliedRequest = useRef(false);
  const [requestRejected, setRequestRejected] = useState(false);
  useEffect(() => {
    if (appliedRequest.current || !requestedOrderId || orders.loading) return;
    if (orders.data?.status !== 'ok') return;
    appliedRequest.current = true;
    const match = orders.data.orders.find((o) => o.externalOrderId === requestedOrderId);
    if (match) onSelect(match.externalOrderId);
    else setRequestRejected(true);
  }, [requestedOrderId, orders.loading, orders.data, onSelect]);

  const unavailable = orders.data?.status === 'unavailable' || Boolean(orders.error);
  const list = orders.data?.status === 'ok' ? orders.data.orders : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>Link a GGX Business+ order</CardTitle>
        <p className="text-sm text-muted-foreground">
          Orders on the {orgName} account. Optional — you can submit without one.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {requestRejected && (
          <Alert variant="warning" title="That order isn't available">
            The order you arrived with isn&apos;t on your account, so it can&apos;t be linked. Pick one
            of your own orders below, or continue without one.
          </Alert>
        )}

        {unavailable ? (
          <Alert variant="warning" title="GGX Business+ is unreachable">
            We can&apos;t load your orders right now. You can still submit your ticket without a linked
            order — describe the concern and include the tracking number if you have it.
          </Alert>
        ) : (
          <>
            <Input
              type="search"
              aria-label="Search your orders"
              placeholder="Search order ID, tracking number, or recipient…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Select an order to link</legend>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm has-[:checked]:border-accent-brand has-[:checked]:bg-accent-brand/5">
                <input
                  type="radio"
                  name="bp-order"
                  checked={selectedOrderId === null}
                  onChange={() => onSelect(null)}
                />
                <span className="text-foreground">No order — continue without linking</span>
              </label>

              {orders.loading ? (
                <p className="px-1 py-2 text-sm text-muted-foreground">Loading your orders…</p>
              ) : list.length === 0 ? (
                <p className="px-1 py-2 text-sm text-muted-foreground">No orders match your search.</p>
              ) : (
                list.map((o) => (
                  <label
                    key={o.externalOrderId}
                    className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-3 text-sm has-[:checked]:border-accent-brand has-[:checked]:bg-accent-brand/5"
                  >
                    <input
                      type="radio"
                      name="bp-order"
                      className="mt-0.5"
                      checked={selectedOrderId === o.externalOrderId}
                      onChange={() => onSelect(o.externalOrderId)}
                      aria-label={`Order ${o.externalOrderId}, tracking ${o.trackingNumber}`}
                    />
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs font-medium text-foreground">{o.trackingNumber}</span>
                        <ShipmentStatusBadge status={o.shipmentStatus} />
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {o.externalOrderId} · {o.recipientSummary} · Booked {formatDate(o.bookingDate)}
                      </span>
                    </span>
                  </label>
                ))
              )}
            </fieldset>
          </>
        )}
      </CardContent>
    </Card>
  );
}
