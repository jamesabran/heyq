/**
 * customer — the Business+-facing read surface, wrapping server/visibility.ts.
 *
 * Not consumed by GGX Corporate yet (its mock HeyQ adapter is a separate repo,
 * swapped later) — this makes the M23 visibility policy reachable over HTTP so
 * that swap is a drop-in later.
 *
 * HTTP surface:
 *   GET /customer/tickets      → listCustomerTickets
 *   GET /customer/tickets/:id  → getCustomerTicket
 */
import { teams } from '../src/app/data/catalog.ts';
import type { CustomerTicket } from '../src/app/models/ticket.ts';
import { getStore } from './store.ts';
import { isVisibleToRequester, toCustomerTicket, type RequesterIdentity } from './visibility.ts';

const teamNameOf = (id: string) => teams.find((t) => t.id === id)?.name ?? 'Unassigned';

/** Every ticket visible to this requester, newest activity first. */
export async function listCustomerTickets(storeId: string, who: RequesterIdentity): Promise<CustomerTicket[]> {
  const store = getStore(storeId);
  return store.tickets
    .filter((t) => isVisibleToRequester(t, who))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((t) => toCustomerTicket(t, store, teamNameOf));
}

/** One ticket, only if visible to this requester — otherwise null (404). */
export async function getCustomerTicket(storeId: string, who: RequesterIdentity, ticketId: string): Promise<CustomerTicket | null> {
  const store = getStore(storeId);
  const ticket = store.tickets.find((t) => t.id === ticketId);
  if (!ticket || !isVisibleToRequester(ticket, who)) return null;
  return toCustomerTicket(ticket, store, teamNameOf);
}
