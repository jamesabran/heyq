/**
 * Multi-transaction Business+ report tickets (M26) — HeyQ server side.
 *
 * One ticket may reference MANY transactions (the Business+ report drawer's
 * multi-select). This proves the HeyQ half of that contract:
 *   • createCustomerTicket stores a `linkedTransactions` collection (order preserved)
 *     and mirrors the first into `linkedOrder` for every legacy reader;
 *   • single-transaction and legacy `linkedOrder`-only tickets keep working
 *     (backward compatibility) and normalize to a one-element collection;
 *   • an unlinked (general) report is created with no linked transactions;
 *   • the customer projection carries the whole collection;
 *   • agent list rows expose the primary tracking number plus all of them, and
 *     EVERY linked tracking number stays searchable.
 *
 * Business+ owns OMS authorization and pre-authorizes each transaction, so the
 * embedded-context path trusts the given list (mirrors createTicket's contract).
 */
import { beforeEach, describe, expect, it } from 'vitest';
import type { LinkedOrder } from '../src/app/models/ticket.ts';
import { createCustomerTicket, listCustomerTickets, getCustomerTicket } from './customer.ts';
import { listTickets, trackingNumbersFor } from './tickets.ts';
import { DEFAULT_STORE, getStore, resetStore } from './store.ts';

const IDENTITY = { externalUserId: 'max@email.com', externalOrgId: 'main' };

function linked(externalOrderId: string, trackingNumber: string, shipmentStatus: LinkedOrder['snapshot']['shipmentStatus'], route: string): LinkedOrder {
  return {
    externalOrderId,
    trackingNumber,
    capturedAt: '2026-07-17T00:00:00Z',
    snapshot: { shipmentStatus, bookingDate: '2026-07-10', route },
  };
}

const A = linked('GGX-2026-90008', 'GGX-2026-90008', 'failed_delivery', 'Metro Manila → Pasig City');
const B = linked('GGX-2026-90009', 'GGX-2026-90009', 'in_transit', 'Makati City → Cebu City');
const C = linked('GGX-2026-90010', 'GGX-2026-90010', 'delivered', 'Taguig City → Davao City');

const base = {
  identity: IDENTITY,
  name: 'Max Cruz',
  email: 'max@email.com',
  concernType: 'general_inquiry' as const,
  subject: 'Multiple affected orders',
  description: 'Several orders have problems.',
};

beforeEach(() => resetStore(DEFAULT_STORE));

describe('multi-transaction customer ticket creation (M26)', () => {
  it('creates ONE ticket linking all transactions, primary first, mirroring linkedOrder', async () => {
    const created = await createCustomerTicket(DEFAULT_STORE, { ...base, linkedTransactions: [A, B, C] });

    expect(created.linkedTransactions?.map((o) => o.trackingNumber)).toEqual([
      'GGX-2026-90008', 'GGX-2026-90009', 'GGX-2026-90010',
    ]);
    // Back-compat mirror: linkedOrder is the primary (first) transaction.
    expect(created.linkedOrder?.trackingNumber).toBe('GGX-2026-90008');

    // And the stored ticket (agent side) holds the same collection.
    const stored = getStore(DEFAULT_STORE).tickets.find((t) => t.id === created.id)!;
    expect(stored.sourceSystem).toBe('ggx_business_plus');
    expect(stored.linkedTransactions).toHaveLength(3);
    expect(stored.linkedOrder?.trackingNumber).toBe('GGX-2026-90008');
  });

  it('normalizes a legacy single linkedOrder into a one-element collection (backward compatible)', async () => {
    const created = await createCustomerTicket(DEFAULT_STORE, { ...base, linkedOrder: A });
    expect(created.linkedOrder?.trackingNumber).toBe('GGX-2026-90008');
    expect(created.linkedTransactions?.map((o) => o.trackingNumber)).toEqual(['GGX-2026-90008']);
  });

  it('creates a general, UNLINKED ticket when no transaction is provided', async () => {
    const created = await createCustomerTicket(DEFAULT_STORE, { ...base, subject: 'General question' });
    expect(created.linkedOrder).toBeUndefined();
    expect(created.linkedTransactions).toBeUndefined();
    // Still a real, customer-visible ticket.
    const mine = await listCustomerTickets(DEFAULT_STORE, IDENTITY);
    expect(mine.some((t) => t.id === created.id)).toBe(true);
  });

  it('projects the whole collection to the customer view', async () => {
    const created = await createCustomerTicket(DEFAULT_STORE, { ...base, linkedTransactions: [A, B] });
    const fetched = await getCustomerTicket(DEFAULT_STORE, IDENTITY, created.id);
    expect(fetched?.linkedTransactions?.map((o) => o.trackingNumber)).toEqual([
      'GGX-2026-90008', 'GGX-2026-90009',
    ]);
  });
});

describe('agent list — compact display + all-tracking search (M26)', () => {
  it('exposes the primary plus every linked tracking number, and finds the ticket by ANY of them', async () => {
    const created = await createCustomerTicket(DEFAULT_STORE, { ...base, linkedTransactions: [A, B, C] });
    const stored = getStore(DEFAULT_STORE).tickets.find((t) => t.id === created.id)!;

    // All numbers, primary first (drives "first + N more").
    expect(trackingNumbersFor(stored)).toEqual(['GGX-2026-90008', 'GGX-2026-90009', 'GGX-2026-90010']);

    const row = (await listTickets(DEFAULT_STORE)).find((i) => i.ticket.id === created.id)!;
    expect(row.trackingNumber).toBe('GGX-2026-90008'); // primary anchors the row
    expect(row.trackingNumbers).toEqual(['GGX-2026-90008', 'GGX-2026-90009', 'GGX-2026-90010']);

    // Every linked tracking number is searchable — not just the primary.
    for (const q of ['90008', '90009', '90010']) {
      const hits = await listTickets(DEFAULT_STORE, { search: q });
      expect(hits.some((i) => i.ticket.id === created.id)).toBe(true);
    }
  });
});
