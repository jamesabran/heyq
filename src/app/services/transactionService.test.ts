import { describe, expect, it } from 'vitest';
import {
  getTransactionForTicket,
  lookupByTracking,
} from './transactionService';

describe('transactionService.getTransactionForTicket', () => {
  it('returns "none" when no transaction is linked', async () => {
    const r = await getTransactionForTicket(undefined);
    expect(r.status).toBe('none');
  });

  it('returns "unavailable" for an unresolvable id', async () => {
    const r = await getTransactionForTicket('TXN-DOES-NOT-EXIST');
    expect(r.status).toBe('unavailable');
  });

  it('returns a found transaction with masked sender/recipient and a data source', async () => {
    const r = await getTransactionForTicket('TXN-2002');
    expect(r.status).toBe('found');
    if (r.status !== 'found') return;
    expect(r.transaction.senderMasked).toMatch(/\*/);
    expect(r.transaction.recipientMasked).toMatch(/\*/);
    expect(r.transaction.dataSource).toBeTruthy();
    // COD collected but not yet remitted.
    expect(r.transaction.paymentStatus).toBe('paid');
    expect(r.transaction.remittanceStatus).toBe('pending');
  });

  it('flags stale data when the record predates the staleness window', async () => {
    // TXN-2001 last updated 2026-07-08 vs simulated now 2026-07-14 (>48h).
    const r = await getTransactionForTicket('TXN-2001');
    expect(r.status).toBe('found');
    if (r.status === 'found') expect(r.stale).toBe(true);
  });

  it('enforces ownership: another team sees permission_denied, the owning team does not', async () => {
    const denied = await getTransactionForTicket('TXN-2005', 'team-cs');
    expect(denied.status).toBe('permission_denied');
    const owner = await getTransactionForTicket('TXN-2005', 'team-claims');
    expect(owner.status).toBe('found');
    const admin = await getTransactionForTicket('TXN-2005', undefined);
    expect(admin.status).toBe('found');
  });
});

describe('transactionService.lookupByTracking', () => {
  it('resolves a single exact match', async () => {
    const r = await lookupByTracking('D4XV-A7ND-SQCZ');
    expect(r.status).toBe('found');
  });

  it('matches a partial tracking number, case-insensitively', async () => {
    const r = await lookupByTracking('a7nd');
    expect(r.status).toBe('found');
    if (r.status === 'found') expect(r.transaction.trackingNumber).toBe('D4XV-A7ND-SQCZ');
  });

  it('returns invalid for an unmatched tracking number', async () => {
    const r = await lookupByTracking('NOPE-000');
    expect(r.status).toBe('invalid');
  });

  it('returns multiple matches for an ambiguous partial query', async () => {
    // "KP" opens KP3D-9VXA-R60T and closes T5X0-0BMM-KPP6.
    const r = await lookupByTracking('KP');
    expect(r.status).toBe('multiple');
    if (r.status === 'multiple') expect(r.matches.length).toBeGreaterThan(1);
  });
});
