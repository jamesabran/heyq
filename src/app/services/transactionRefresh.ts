/**
 * transactionRefresh — background refresh coordinator for stale GGX/OMS
 * transaction snapshots (M13 freshness follow-up).
 *
 * The queues, Overview, and ticket detail all render the snapshot saved on the
 * ticket. When that snapshot is past its freshness window we re-fetch the live
 * record through the SAME adapter the manual refresh uses (transactionService,
 * the OMS seam) — display only. This module adds one thing on top: it collapses
 * concurrent refreshes of the SAME external order into a single in-flight read,
 * so several rows (or several components) pointing at one transaction don't each
 * hit the provider.
 *
 * It deliberately does NOT poll and NEVER touches the HeyQ ticket status — a
 * shipment or payment moving upstream is a separate dimension from the ticket's
 * workflow (docs/product-rules.md #13).
 */
import { refreshTransaction, type TransactionResult } from './transactionService';

// Keyed by transaction id + viewer scope: the same id seen by two different teams
// is a different authorization decision, so they must not share a read.
const inFlight = new Map<string, Promise<TransactionResult>>();

function keyOf(id: string, viewerTeamId?: string): string {
  return `${id}::${viewerTeamId ?? ''}`;
}

/**
 * Refresh one stale transaction, deduplicated by (id, viewer scope). Concurrent
 * callers for the same external order receive the exact same promise; once it
 * settles the entry is dropped so a later refresh starts fresh.
 */
export function refreshStaleTransaction(
  id: string,
  viewerTeamId?: string,
): Promise<TransactionResult> {
  const key = keyOf(id, viewerTeamId);
  const existing = inFlight.get(key);
  if (existing) return existing;

  const pending = refreshTransaction(id, viewerTeamId).finally(() => {
    inFlight.delete(key);
  });
  inFlight.set(key, pending);
  return pending;
}
