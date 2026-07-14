/**
 * orderProvider — the replaceable GGX Business+ boundary (M22).
 *
 * HeyQ owns tickets, requesters, assignment, SLA, and audit; Business+ owns the
 * order catalogue and who may see it. This interface is the seam between them:
 * today it is backed by mock data, later by the real Business+ API — the
 * consumers (contact form, ticket creation, agent order panel) don't change.
 *
 * Authorization is enforced HERE, not in the UI: every requester-scoped call
 * carries the caller's external user + org identity, and an order outside that
 * scope comes back `forbidden` — indistinguishable work the real API will do
 * with a session token. Agents use a separate support-scoped lookup that exists
 * only to display context on a ticket that already links the order.
 *
 * Future API endpoints (Business+ side — see docs/business-plus-integration.md):
 *   GET /support/orders?query=          → listAuthorizedOrders (session-scoped)
 *   GET /support/orders/:externalId     → getAuthorizedOrder  (session-scoped)
 *   GET /internal/orders/:externalId    → getOrderForSupport  (service-scoped)
 */
import {
  businessPlusOrders,
  businessPlusProviderState,
  businessPlusUsers,
  type BusinessPlusOrderRecord,
} from '../data/businessPlusOrders';
import { clone, simulateLatency } from '../lib/mock';

/** Who is asking — the authenticated Business+ user and their organization. */
export interface OrderProviderIdentity {
  externalUserId: string;
  externalOrgId: string;
}

/** What the provider returns for one order. Same shape the real API will serve. */
export type ExternalOrder = Omit<BusinessPlusOrderRecord, never>;

export type OrderListResult =
  | { status: 'ok'; orders: ExternalOrder[] }
  | { status: 'unavailable' };

export type OrderLookupResult =
  | { status: 'ok'; order: ExternalOrder }
  | { status: 'forbidden' }
  | { status: 'not_found' }
  | { status: 'unavailable' };

export interface OrderProvider {
  /** The caller's authorized orders, optionally narrowed by a search query. */
  listAuthorizedOrders(identity: OrderProviderIdentity, query?: string): Promise<OrderListResult>;
  /** One order, only if it is inside the caller's authorization scope. */
  getAuthorizedOrder(identity: OrderProviderIdentity, externalOrderId: string): Promise<OrderLookupResult>;
  /**
   * Support-scoped lookup for agents viewing a ticket that already links this
   * order. Read-only context; it can never mutate a shipment.
   */
  getOrderForSupport(externalOrderId: string): Promise<OrderLookupResult>;
}

/** The user belongs to the org they claim — the mock's stand-in for a session. */
function identityIsValid(identity: OrderProviderIdentity): boolean {
  return businessPlusUsers.some(
    (u) => u.externalUserId === identity.externalUserId && u.externalOrgId === identity.externalOrgId,
  );
}

const inScope = (order: BusinessPlusOrderRecord, identity: OrderProviderIdentity) =>
  order.externalOrgId === identity.externalOrgId;

const mockProvider: OrderProvider = {
  async listAuthorizedOrders(identity, query) {
    await simulateLatency();
    if (!businessPlusProviderState.available) return { status: 'unavailable' };
    if (!identityIsValid(identity)) return { status: 'ok', orders: [] };

    let orders = businessPlusOrders.filter((o) => inScope(o, identity));
    if (query?.trim()) {
      const q = query.trim().toLowerCase();
      orders = orders.filter((o) =>
        `${o.externalOrderId} ${o.trackingNumber} ${o.recipientSummary} ${o.destination ?? ''}`
          .toLowerCase()
          .includes(q),
      );
    }
    return { status: 'ok', orders: clone(orders) };
  },

  async getAuthorizedOrder(identity, externalOrderId) {
    await simulateLatency();
    if (!businessPlusProviderState.available) return { status: 'unavailable' };

    const order = businessPlusOrders.find((o) => o.externalOrderId === externalOrderId);
    if (!order) return { status: 'not_found' };
    // Out-of-scope reads are rejected regardless of whether the order exists —
    // the caller learns nothing about other organizations' shipments.
    if (!identityIsValid(identity) || !inScope(order, identity)) return { status: 'forbidden' };
    return { status: 'ok', order: clone(order) };
  },

  async getOrderForSupport(externalOrderId) {
    await simulateLatency();
    if (!businessPlusProviderState.available) return { status: 'unavailable' };
    const order = businessPlusOrders.find((o) => o.externalOrderId === externalOrderId);
    if (!order) return { status: 'not_found' };
    return { status: 'ok', order: clone(order) };
  },
};

/** The swap point: the real Business+-backed provider replaces this return. */
export function getOrderProvider(): OrderProvider {
  return mockProvider;
}
