/**
 * orderProvider — server-side port of src/app/services/orderProvider.ts.
 *
 * The mock GGX Business+ boundary. Order authorization has to be enforced here,
 * not in the browser, to be real: every requester-scoped call carries the
 * caller's external user + org identity, and an order outside that scope comes
 * back `forbidden`. The outage simulation reuses the store's generic
 * isDown/setDown (server/store.ts) instead of a separate availability flag.
 *
 * Future API endpoints (Business+ side — see docs/business-plus-integration.md):
 *   GET /support/orders?query=          → listAuthorizedOrders (session-scoped)
 *   GET /support/orders/:externalId     → getAuthorizedOrder  (session-scoped)
 *   GET /internal/orders/:externalId    → getOrderForSupport  (service-scoped)
 */
import type { BusinessPlusOrderRecord } from '../src/app/data/businessPlusOrders.ts';
import { clone, simulateLatency } from '../src/app/lib/mock.ts';
import { getStore, isDown } from './store.ts';

/** Who is asking — the authenticated Business+ user and their organization. */
export interface OrderProviderIdentity {
  externalUserId: string;
  externalOrgId: string;
}

export type ExternalOrder = BusinessPlusOrderRecord;

export type OrderListResult =
  | { status: 'ok'; orders: ExternalOrder[] }
  | { status: 'unavailable' };

export type OrderLookupResult =
  | { status: 'ok'; order: ExternalOrder }
  | { status: 'forbidden' }
  | { status: 'not_found' }
  | { status: 'unavailable' };

function identityIsValid(storeId: string, identity: OrderProviderIdentity): boolean {
  const store = getStore(storeId);
  return store.businessPlusUsers.some(
    (u) => u.externalUserId === identity.externalUserId && u.externalOrgId === identity.externalOrgId,
  );
}

const inScope = (order: BusinessPlusOrderRecord, identity: OrderProviderIdentity) =>
  order.externalOrgId === identity.externalOrgId;

/** The caller's authorized orders, optionally narrowed by a search query. */
export async function listAuthorizedOrders(
  storeId: string,
  identity: OrderProviderIdentity,
  query?: string,
): Promise<OrderListResult> {
  await simulateLatency();
  if (isDown(storeId)) return { status: 'unavailable' };
  if (!identityIsValid(storeId, identity)) return { status: 'ok', orders: [] };

  const store = getStore(storeId);
  let orders = store.businessPlusOrders.filter((o) => inScope(o, identity));
  if (query?.trim()) {
    const q = query.trim().toLowerCase();
    orders = orders.filter((o) =>
      `${o.externalOrderId} ${o.trackingNumber} ${o.recipientSummary} ${o.destination ?? ''}`
        .toLowerCase()
        .includes(q),
    );
  }
  return { status: 'ok', orders: clone(orders) };
}

/** One order, only if it is inside the caller's authorization scope. */
export async function getAuthorizedOrder(
  storeId: string,
  identity: OrderProviderIdentity,
  externalOrderId: string,
): Promise<OrderLookupResult> {
  await simulateLatency();
  if (isDown(storeId)) return { status: 'unavailable' };

  const store = getStore(storeId);
  const order = store.businessPlusOrders.find((o) => o.externalOrderId === externalOrderId);
  if (!order) return { status: 'not_found' };
  // Out-of-scope reads are rejected regardless of whether the order exists —
  // the caller learns nothing about other organizations' shipments.
  if (!identityIsValid(storeId, identity) || !inScope(order, identity)) return { status: 'forbidden' };
  return { status: 'ok', order: clone(order) };
}

/**
 * Support-scoped lookup for agents viewing a ticket that already links this
 * order. Read-only context; it can never mutate a shipment.
 */
export async function getOrderForSupport(storeId: string, externalOrderId: string): Promise<OrderLookupResult> {
  await simulateLatency();
  if (isDown(storeId)) return { status: 'unavailable' };
  const store = getStore(storeId);
  const order = store.businessPlusOrders.find((o) => o.externalOrderId === externalOrderId);
  if (!order) return { status: 'not_found' };
  return { status: 'ok', order: clone(order) };
}

/**
 * TEST-ONLY: mutate one order's live shipment status, standing in for
 * Business+ updating its own record upstream. Used by
 * businessPlusFlow.test.ts to prove a live change never touches a ticket's
 * already-captured snapshot.
 */
export function setOrderShipmentStatusForTest(
  storeId: string,
  externalOrderId: string,
  shipmentStatus: BusinessPlusOrderRecord['shipmentStatus'],
): void {
  const store = getStore(storeId);
  const order = store.businessPlusOrders.find((o) => o.externalOrderId === externalOrderId);
  if (order) order.shipmentStatus = shipmentStatus;
}
