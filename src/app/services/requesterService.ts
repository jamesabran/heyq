/**
 * requesterService — thin HTTP client over server/requester.ts. Resolves the
 * simulated secure-link (access token) for the requester portal; a ticket
 * reference alone never resolves here (docs/product-rules.md #6).
 *
 * Endpoints:
 *   GET /portal/:token           → resolveAccessToken
 *   GET /requesters/:id/profile  → getRequesterProfile
 *   GET /requesters/:id/tickets  → listTicketsForRequester
 */
import type { Requester, Ticket } from '../models/ticket';
import { ApiError, apiGet } from '../lib/apiClient';

export interface PortalView {
  ticket: Ticket;
  requester: Requester;
  teamName: string;
  categoryName: string;
  subcategoryName?: string;
}

export interface RequesterTicketSummary {
  ticket: Ticket;
  categoryName: string;
  trackingNumber?: string;
  accessToken?: string;
}

export async function resolveAccessToken(token: string): Promise<PortalView | null> {
  try {
    return await apiGet<PortalView>(`/portal/${token}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function getRequesterProfile(
  requesterId: string,
): Promise<Pick<Requester, 'name' | 'email' | 'mobile'> | null> {
  try {
    return await apiGet<Pick<Requester, 'name' | 'email' | 'mobile'>>(`/requesters/${requesterId}/profile`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function listTicketsForRequester(requesterId: string): Promise<RequesterTicketSummary[]> {
  return apiGet<RequesterTicketSummary[]>(`/requesters/${requesterId}/tickets`);
}
