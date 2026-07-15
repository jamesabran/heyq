import { describe, expect, it } from 'vitest';
import { refreshStaleTransaction } from './transactionRefresh';

describe('transactionRefresh.refreshStaleTransaction', () => {
  it('deduplicates concurrent refreshes of the same external order', async () => {
    const first = refreshStaleTransaction('TXN-2001');
    const second = refreshStaleTransaction('TXN-2001');
    // Concurrent callers share the one in-flight provider read.
    expect(second).toBe(first);

    await first;

    // Once it settles the entry is cleared, so a later refresh starts a new read.
    const third = refreshStaleTransaction('TXN-2001');
    expect(third).not.toBe(first);
    await third;
  });

  it('keys the in-flight read by viewer scope, not just id', () => {
    const asCs = refreshStaleTransaction('TXN-2005', 'team-cs');
    const asClaims = refreshStaleTransaction('TXN-2005', 'team-claims');
    // Same id, different authorization decision → must not be shared.
    expect(asClaims).not.toBe(asCs);
    return Promise.all([asCs, asClaims]);
  });

  it('returns the live record on success, and honors ownership on failure', async () => {
    const owner = await refreshStaleTransaction('TXN-2005', 'team-claims');
    expect(owner.status).toBe('found');
    if (owner.status === 'found') {
      expect(owner.transaction.id).toBe('TXN-2005');
    }

    const denied = await refreshStaleTransaction('TXN-2005', 'team-cs');
    expect(denied.status).toBe('permission_denied');
  });
});
