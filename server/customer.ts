/**
 * customer — the Business+-facing surface, wrapping server/visibility.ts.
 *
 * GGX Business+ reads its tickets and submits new ones here. HeyQ enforces
 * visibility server-side; this surface never returns agent-only data.
 *
 * HTTP surface:
 *   GET  /customer/tickets      → listCustomerTickets
 *   GET  /customer/tickets/:id  → getCustomerTicket
 *   POST /customer/tickets      → createCustomerTicket
 */
import { teams } from '../src/app/data/catalog.ts';
import type { ConcernType, CustomerTicket, LinkedOrder } from '../src/app/models/ticket.ts';
import { createTicket } from './tickets.ts';
import type { OrderProviderIdentity } from './orderProvider.ts';
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

// ── Creation (embedded Business+ report flow) ────────────────────────────────

/** Route a concern to its owning category. Concern stays the triage descriptor. */
const CATEGORY_BY_CONCERN: Record<ConcernType, string> = {
  delivery_delay: 'cat-delivery',
  pickup_issue: 'cat-pickup',
  missing_parcel: 'cat-claims',
  damaged_parcel: 'cat-claims',
  cod_concern: 'cat-cod',
  remittance_concern: 'cat-disbursal',
  payment_issue: 'cat-payment',
  booking_issue: 'cat-general',
  address_correction: 'cat-delivery',
  account_concern: 'cat-account',
  general_inquiry: 'cat-general',
};

export interface CreateCustomerTicketInput {
  identity: OrderProviderIdentity;
  /** Requester display fields for the ticket's guest requester record. */
  name: string;
  email: string;
  concernType?: ConcernType;
  subject: string;
  description: string;
  /** Linked order, pre-authorized by Business+ (OMS owner). Optional. */
  linkedOrder?: LinkedOrder;
}

/**
 * Create a ticket submitted from the embedded Business+ report drawer and return
 * its CUSTOMER projection (never the agent record). Business+ owns order
 * authorization, so the identity + linked order are trusted here (see
 * createTicket's `businessPlusContext`). Concern → category routing lives here;
 * HeyQ owns the taxonomy.
 */
export async function createCustomerTicket(storeId: string, input: CreateCustomerTicketInput): Promise<CustomerTicket> {
  const concernType: ConcernType = input.concernType && CATEGORY_BY_CONCERN[input.concernType]
    ? input.concernType
    : 'general_inquiry';
  const categoryId = CATEGORY_BY_CONCERN[concernType];

  const { ticket } = await createTicket(storeId, {
    name: input.name,
    email: input.email,
    categoryId,
    concernType,
    subject: input.subject,
    description: input.description,
    businessPlusContext: { identity: input.identity, linkedOrder: input.linkedOrder },
  });

  return toCustomerTicket(ticket, getStore(storeId), teamNameOf);
}
