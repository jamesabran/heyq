/**
 * orderProvider — thin HTTP client over server/orderProvider.ts (the mock GGX
 * Business+ boundary). Authorization is enforced server-side now — every
 * requester-scoped call carries the caller's external user + org identity,
 * and an order outside that scope comes back `forbidden`.
 *
 * Endpoints:
 *   GET /business-plus-orders?externalUserId=&externalOrgId=&query= → listAuthorizedOrders
 *   GET /business-plus-orders/:externalId?externalUserId=&externalOrgId= → getAuthorizedOrder
 *   GET /business-plus-orders/:externalId/support → getOrderForSupport
 */
import type { BusinessPlusOrderRecord } from '../data/businessPlusOrders';
import { apiGet, apiPatch, apiPost, buildQuery } from '../lib/apiClient';

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

export interface OrderProvider {
  listAuthorizedOrders(identity: OrderProviderIdentity, query?: string): Promise<OrderListResult>;
  getAuthorizedOrder(identity: OrderProviderIdentity, externalOrderId: string): Promise<OrderLookupResult>;
  getOrderForSupport(externalOrderId: string): Promise<OrderLookupResult>;
}

const httpProvider: OrderProvider = {
  async listAuthorizedOrders(identity, query) {
    return apiGet<OrderListResult>(
      `/business-plus-orders${buildQuery({ ...identity, query })}`,
    );
  },

  async getAuthorizedOrder(identity, externalOrderId) {
    return apiGet<OrderLookupResult>(
      `/business-plus-orders/${externalOrderId}${buildQuery({ ...identity })}`,
    );
  },

  async getOrderForSupport(externalOrderId) {
    return apiGet<OrderLookupResult>(`/business-plus-orders/${externalOrderId}/support`);
  },
};

/** The swap point: the real Business+-backed provider replaces this return. */
export function getOrderProvider(): OrderProvider {
  return httpProvider;
}

// ── Test-only infrastructure controls ────────────────────────────────────────
// Back the simulated outage / upstream-update scenarios in orderProvider.test.ts
// and businessPlusFlow.test.ts. Never called by product code.

export async function setBusinessPlusProviderDown(down: boolean): Promise<void> {
  await apiPost<{ ok: true }>('/_test/down', { down });
}

export async function setBusinessPlusOrderShipmentStatusForTest(
  externalOrderId: string,
  shipmentStatus: BusinessPlusOrderRecord['shipmentStatus'],
): Promise<void> {
  await apiPatch<{ ok: true }>(`/_test/business-plus-orders/${externalOrderId}`, { shipmentStatus });
}
