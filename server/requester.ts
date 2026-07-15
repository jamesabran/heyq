/**
 * requester — server-side port of src/app/services/requesterService.ts.
 *
 * Resolves the simulated secure-link (access token) for the requester portal.
 * This is the ONLY way to open a ticket in the portal; a ticket reference alone
 * does not resolve here (docs/product-rules.md #6).
 *
 * HTTP surface:
 *   GET /portal/:token       → resolveAccessToken
 *   GET /requesters/:id/profile → getRequesterProfile
 *   GET /requesters/:id/tickets → listTicketsForRequester
 */
import { teams, ticketCategories } from '../src/app/data/catalog.ts';
import type { Requester, Ticket } from '../src/app/models/ticket.ts';
import { clone, simulateLatency } from '../src/app/lib/mock.ts';
import { getStore } from './store.ts';
import { trackingNumberFor } from './tickets.ts';

export interface PortalView {
  ticket: Ticket;
  requester: Requester;
  teamName: string;
  categoryName: string;
  subcategoryName?: string;
}

/** One of the requester's own tickets, with the secure link that opens it. */
export interface RequesterTicketSummary {
  ticket: Ticket;
  categoryName: string;
  /** The GGX tracking number, same as every agent-facing list; absent on non-shipment tickets. */
  trackingNumber?: string;
  /** Undefined when no secure link was ever issued — the row then isn't openable. */
  accessToken?: string;
}

/** Resolve an opaque access token to the portal view, or null if unknown. */
export async function resolveAccessToken(storeId: string, token: string): Promise<PortalView | null> {
  await simulateLatency();
  const store = getStore(storeId);

  const access = store.requesterAccess.find((a) => a.accessToken === token);
  if (!access) return null;

  const ticket = store.tickets.find((t) => t.id === access.ticketId);
  const requester = ticket && store.requesters.find((r) => r.id === ticket.requesterId);
  if (!ticket || !requester) return null;

  const category = ticketCategories.find((c) => c.id === ticket.categoryId);
  const subcategory = category?.subcategories.find((s) => s.id === ticket.subcategoryId);
  const team = teams.find((t) => t.id === ticket.teamId);

  return clone({
    ticket,
    requester,
    teamName: team?.name ?? 'Unassigned',
    categoryName: category?.name ?? 'Uncategorized',
    subcategoryName: subcategory?.name,
  });
}

/** Contact details for prefilling forms when a known requester is signed in. */
export async function getRequesterProfile(
  storeId: string,
  requesterId: string,
): Promise<Pick<Requester, 'name' | 'email' | 'mobile'> | null> {
  await simulateLatency();
  const store = getStore(storeId);
  const r = store.requesters.find((x) => x.id === requesterId);
  return r ? clone({ name: r.name, email: r.email, mobile: r.mobile }) : null;
}

/**
 * The requester's own tickets, newest activity first, each with its access
 * token so the row can open the portal. Requesters never see agent surfaces:
 * this returns no assignee, no internal notes, and no team routing.
 */
export async function listTicketsForRequester(storeId: string, requesterId: string): Promise<RequesterTicketSummary[]> {
  await simulateLatency();
  const store = getStore(storeId);

  return store.tickets
    .filter((t) => t.requesterId === requesterId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((ticket) =>
      clone({
        ticket,
        categoryName: ticketCategories.find((c) => c.id === ticket.categoryId)?.name ?? 'Uncategorized',
        trackingNumber: trackingNumberFor(ticket),
        accessToken: store.requesterAccess.find((a) => a.ticketId === ticket.id)?.accessToken,
      }),
    );
}
