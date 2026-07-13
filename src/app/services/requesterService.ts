/**
 * requesterService — resolves the simulated secure-link (access token) for the
 * requester portal. This is the ONLY way to open a ticket in the portal; a
 * ticket reference alone does not resolve here (docs/product-rules.md #6).
 *
 * Future API endpoints:
 *   GET /portal/:token   → resolveAccessToken
 */
import { requesterAccess, requesters, tickets } from '../data/tickets';
import { teams, ticketCategories } from '../data/catalog';
import type { Requester, Ticket } from '../models/ticket';
import { clone, simulateLatency } from '../lib/mock';

export interface PortalView {
  ticket: Ticket;
  requester: Requester;
  teamName: string;
  categoryName: string;
  subcategoryName?: string;
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
