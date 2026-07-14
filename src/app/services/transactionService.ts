/**
 * transactionService — GGX transaction-context facade (M13).
 *
 * Reduces the need for agents to open a separate GGX system: it resolves a
 * transaction linked to a ticket, and looks one up by tracking number. Today it
 * reads mock seed data; in Phase 2 M17/M18 the SAME signatures are backed by the
 * real GGX transaction/payment/remittance systems (an INTEGRATION behind this
 * seam, never a runtime foundation — docs/product-rules.md #14).
 *
 * The three statuses on RelatedTransaction (shipment, payment, remittance) are
 * independent of each other and of the support ticket's workflow status (#13).
 * Sender/recipient come pre-masked (#15). Ownership restrictions are enforced
 * here, not in the contract.
 *
 * Future API endpoints:
 *   GET  /transactions/:id                 → (internal) resolve by id
 *   GET  /transactions/lookup?tracking=    → lookupByTracking (0 / 1 / many)
 *   POST /transactions/:id/refresh         → refresh (re-fetch live)
 */
import { relatedTransactions, transactionAccess } from '../data/catalog';
import type { RelatedTransaction } from '../models/ticket';
import { simulatedNowMs } from '../lib/clock';
import { clone, simulateLatency } from '../lib/mock';

// Data older than this (relative to the simulated clock) is flagged "stale" so
// agents know to refresh before acting.
const STALE_AFTER_MS = 48 * 60 * 60 * 1000; // 48h

/** Result of resolving the transaction linked to a ticket. */
export type TransactionResult =
  | { status: 'none' } // no transaction linked
  | { status: 'unavailable' } // linked id can't be resolved (system down / bad ref)
  | { status: 'permission_denied' } // agent lacks access to this transaction
  | { status: 'found'; transaction: RelatedTransaction; stale: boolean };

/** Compact match used by the tracking-number lookup disambiguation list. */
export interface TransactionMatch {
  id: string;
  trackingNumber: string;
  shipmentStatus: RelatedTransaction['shipmentStatus'];
  destination?: string;
}

/** Result of looking a transaction up by tracking number. */
export type TrackingLookupResult =
  | { status: 'invalid'; query: string } // unmatched / unrecognized tracking number
  | { status: 'unavailable' }
  | { status: 'multiple'; matches: TransactionMatch[] } // needs disambiguation
  | { status: 'found'; transaction: RelatedTransaction; stale: boolean };

function isStale(txn: RelatedTransaction): boolean {
  return simulatedNowMs() - new Date(txn.lastUpdatedAt).getTime() > STALE_AFTER_MS;
}

function find(id: string): RelatedTransaction | undefined {
  return relatedTransactions.find((t) => t.id === id);
}

/**
 * Resolve the transaction linked to a ticket.
 * `viewerTeamId === undefined` means an unrestricted viewer (e.g. admin).
 */
export async function getTransactionForTicket(
  relatedTransactionId: string | undefined,
  viewerTeamId?: string,
): Promise<TransactionResult> {
  await simulateLatency();
  if (!relatedTransactionId) return { status: 'none' };

  const txn = find(relatedTransactionId);
  if (!txn) return { status: 'unavailable' };

  // Restricted transactions: admin (no team scope) and the owning team may view;
  // any other team sees the ownership-mismatch state.
  const restriction = transactionAccess[txn.id];
  if (restriction && viewerTeamId !== undefined && viewerTeamId !== restriction.allowedTeamId) {
    return { status: 'permission_denied' };
  }

  return { status: 'found', transaction: clone(txn), stale: isStale(txn) };
}

/** Re-fetch a transaction (manual refresh). Mock: returns the current record. */
export async function refreshTransaction(id: string, viewerTeamId?: string): Promise<TransactionResult> {
  return getTransactionForTicket(id, viewerTeamId);
}

/** Look up a transaction by (partial) tracking number: 0 / 1 / many matches. */
export async function lookupByTracking(query: string): Promise<TrackingLookupResult> {
  await simulateLatency();
  const q = query.trim().toUpperCase();
  if (!q) return { status: 'invalid', query };

  const matches = relatedTransactions.filter((t) => t.trackingNumber.toUpperCase().includes(q));
  if (matches.length === 0) return { status: 'invalid', query };
  if (matches.length > 1) {
    return {
      status: 'multiple',
      matches: matches.map((t) => ({
        id: t.id,
        trackingNumber: t.trackingNumber,
        shipmentStatus: t.shipmentStatus,
        destination: t.destination,
      })),
    };
  }
  const txn = matches[0];
  return { status: 'found', transaction: clone(txn), stale: isStale(txn) };
}
