/**
 * requesterService — resolves the simulated secure-link (access token) for the
 * requester portal. This is the ONLY way to open a ticket in the portal; a
 * ticket reference alone does not resolve here (docs/product-rules.md #6).
 *
 * Future API endpoints:
 *   GET /portal/:token   → resolveAccessToken
 *   GET /me/tickets      → listTicketsForRequester
 */
import { requesterAccess, requesters, tickets } from '../data/tickets';
import { relatedTransactions, teams, ticketCategories } from '../data/catalog';
import type { Requester, Ticket } from '../models/ticket';
import { clone, simulateLatency } from '../lib/mock';

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
export async function resolveAccessToken(token: string): Promise<PortalView | null> {
  await simulateLatency();

  const access = requesterAccess.find((a) => a.accessToken === token);
  if (!access) return null;

  const ticket = tickets.find((t) => t.id === access.ticketId);
  const requester = ticket && requesters.find((r) => r.id === ticket.requesterId);
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

/**
 * The requester's own tickets, newest activity first, each with its access
 * token so the row can open the portal. Requesters never see agent surfaces:
 * this returns no assignee, no internal notes, and no team routing.
 */
export async function listTicketsForRequester(requesterId: string): Promise<RequesterTicketSummary[]> {
  await simulateLatency();

  return tickets
    .filter((t) => t.requesterId === requesterId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((ticket) =>
      clone({
        ticket,
        categoryName: ticketCategories.find((c) => c.id === ticket.categoryId)?.name ?? 'Uncategorized',
        trackingNumber: ticket.relatedTransactionId
          ? relatedTransactions.find((t) => t.id === ticket.relatedTransactionId)?.trackingNumber
          : undefined,
        accessToken: requesterAccess.find((a) => a.ticketId === ticket.id)?.accessToken,
      }),
    );
}
