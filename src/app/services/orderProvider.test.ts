import { afterEach, describe, expect, it } from 'vitest';
import { getOrderProvider, setBusinessPlusProviderDown, type OrderProviderIdentity } from './orderProvider';
import { businessPlusOrders } from '../data/businessPlusOrders';

const nadia: OrderProviderIdentity = { externalUserId: 'bp-user-nadia', externalOrgId: 'bp-org-acme' };
const omar: OrderProviderIdentity = { externalUserId: 'bp-user-omar', externalOrgId: 'bp-org-zenith' };

/** Derived from the seed so adding orders (e.g. the Business+ handoff set) can't
 *  break the scoping assertions — what matters is the SCOPE, not the count. */
const countFor = (orgId: string) =>
  businessPlusOrders.filter((o) => o.externalOrgId === orgId).length;

const provider = getOrderProvider();

afterEach(async () => {
  await setBusinessPlusProviderDown(false);
});

describe('orderProvider — authorization (M22)', () => {
  it('lists only the orders inside the caller org', async () => {
    const acme = await provider.listAuthorizedOrders(nadia);
    const zenith = await provider.listAuthorizedOrders(omar);
    if (acme.status !== 'ok' || zenith.status !== 'ok') throw new Error('expected ok');

    expect(acme.orders.length).toBe(countFor('bp-org-acme'));
    expect(acme.orders.every((o) => o.externalOrgId === 'bp-org-acme')).toBe(true);
    expect(zenith.orders.length).toBe(countFor('bp-org-zenith'));
    expect(zenith.orders.every((o) => o.externalOrgId === 'bp-org-zenith')).toBe(true);
  });

  it('narrows the list by a partial search across id, tracking, and recipient', async () => {
    const byCity = await provider.listAuthorizedOrders(nadia, 'davao');
    if (byCity.status !== 'ok') throw new Error('expected ok');
    // Every hit matches the term, and the known Davao order is among them.
    expect(byCity.orders.length).toBeGreaterThan(0);
    expect(byCity.orders.map((o) => o.externalOrderId)).toContain('BP-ORD-7003');
    expect(
      byCity.orders.every((o) =>
        `${o.externalOrderId} ${o.trackingNumber} ${o.recipientSummary} ${o.destination ?? ''}`
          .toLowerCase()
          .includes('davao'),
      ),
    ).toBe(true);

    const byTracking = await provider.listAuthorizedOrders(nadia, '2mrx');
    if (byTracking.status !== 'ok') throw new Error('expected ok');
    expect(byTracking.orders.map((o) => o.externalOrderId)).toEqual(['BP-ORD-7001']);
  });

  it("rejects reads of another organization's order", async () => {
    const crossOrg = await provider.getAuthorizedOrder(nadia, 'BP-ORD-8001');
    expect(crossOrg.status).toBe('forbidden');
  });

  it('rejects an identity whose user does not belong to the claimed org', async () => {
    // Omar claiming Acme membership: the mock's stand-in for a forged session.
    const forged: OrderProviderIdentity = { externalUserId: 'bp-user-omar', externalOrgId: 'bp-org-acme' };
    const get = await provider.getAuthorizedOrder(forged, 'BP-ORD-7001');
    expect(get.status).toBe('forbidden');

    const list = await provider.listAuthorizedOrders(forged);
    if (list.status !== 'ok') throw new Error('expected ok');
    expect(list.orders).toEqual([]);
  });

  it('distinguishes a missing order from a forbidden one only inside scope', async () => {
    const missing = await provider.getAuthorizedOrder(nadia, 'BP-ORD-9999');
    expect(missing.status).toBe('not_found');
  });
});

describe('orderProvider — availability (M22)', () => {
  it('reports unavailable on every read while the provider is down', async () => {
    await setBusinessPlusProviderDown(true);

    expect((await provider.listAuthorizedOrders(nadia)).status).toBe('unavailable');
    expect((await provider.getAuthorizedOrder(nadia, 'BP-ORD-7001')).status).toBe('unavailable');
    expect((await provider.getOrderForSupport('BP-ORD-7003')).status).toBe('unavailable');
  });

  it('serves the support-scoped read for agents viewing linked tickets', async () => {
    const res = await provider.getOrderForSupport('BP-ORD-7003');
    if (res.status !== 'ok') throw new Error('expected ok');
    expect(res.order.trackingNumber).toBe('Y6TN-4QSV-D28E');
    // Live record moved on since tkt-seed-18's snapshot (in_transit).
    expect(res.order.shipmentStatus).toBe('delivered');
  });
});
