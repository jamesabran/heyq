import { useEffect, useRef, useState } from 'react';
import type { PaymentStatus, ShipmentStatus } from '../models/ticket';
import { refreshStaleTransaction } from '../services/transactionRefresh';

/** A stale transaction the caller wants refreshed in the background. */
export interface StaleRefreshTarget {
  /** Transaction id — the stable external-order key used for deduplication. */
  id: string;
  /** Viewer's team scope, forwarded to the provider's ownership check. */
  viewerTeamId?: string;
}

/** The fresh shipment/payment surfaced once a background refresh succeeds. */
export interface RefreshedTransaction {
  shipmentStatus: ShipmentStatus;
  paymentStatus?: PaymentStatus;
}

export interface StaleRefreshState {
  /** By transaction id: fresh shipment/payment for the refreshes that succeeded. */
  refreshed: Record<string, RefreshedTransaction>;
  /** How many stale transactions could NOT be refreshed (provider down / error). */
  failedCount: number;
}

/**
 * Background-refresh the stale transactions in `targets` exactly once each,
 * deduplicated by id across the whole app.
 *
 * The caller keeps rendering its saved snapshot; when a refresh resolves we
 * surface the fresh shipment/payment so the caller can swap it in and drop the
 * stale marker. On failure the caller keeps the saved snapshot and can show a
 * single "couldn't refresh" notice from `failedCount`.
 *
 * It never polls and never re-attempts on re-render: a per-target guard ref means
 * a new `targets` array with the same ids does no extra work, so this is safe to
 * call with a freshly-mapped array every render.
 */
export function useStaleTransactionRefresh(targets: StaleRefreshTarget[]): StaleRefreshState {
  const attempted = useRef<Set<string>>(new Set());
  const [refreshed, setRefreshed] = useState<Record<string, RefreshedTransaction>>({});
  const [failedIds, setFailedIds] = useState<Set<string>>(() => new Set());

  // A stable signature of the target SET, so the effect re-runs only when the set
  // of stale transactions actually changes — not on every render that happens to
  // allocate a new array with the same contents.
  const signature = targets
    .map((t) => `${t.id}::${t.viewerTeamId ?? ''}`)
    .sort()
    .join('|');

  useEffect(() => {
    let active = true;

    for (const target of targets) {
      const key = `${target.id}::${target.viewerTeamId ?? ''}`;
      if (attempted.current.has(key)) continue;
      attempted.current.add(key);

      refreshStaleTransaction(target.id, target.viewerTeamId)
        .then((result) => {
          if (!active) return;
          if (result.status === 'found') {
            setRefreshed((prev) => ({
              ...prev,
              [target.id]: {
                shipmentStatus: result.transaction.shipmentStatus,
                paymentStatus: result.transaction.paymentStatus,
              },
            }));
          } else {
            setFailedIds((prev) => (prev.has(target.id) ? prev : new Set(prev).add(target.id)));
          }
        })
        .catch(() => {
          if (!active) return;
          setFailedIds((prev) => (prev.has(target.id) ? prev : new Set(prev).add(target.id)));
        });
    }

    return () => {
      active = false;
    };
    // `signature` is the meaningful dependency; `targets`/setters are stable enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature]);

  return { refreshed, failedCount: failedIds.size };
}
