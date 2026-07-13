/**
 * ticketService — ticket create/read/reply facade over mock module state.
 *
 * Writes mutate in-memory seed data (reset on reload; per assumption A2). Concern
 * -> team routing uses the category's defaultTeamId (the simplest routing;
 * rule-based overrides land in M6/M8). Reference + access token are generated on
 * create; a ticket reference alone never grants portal access (product rule #6).
 *
 * Future API endpoints:
 *   POST /tickets                      → createTicket
 *   GET  /tickets/:id                  → getTicketById
 *   GET  /tickets/:id/messages         → listMessages
 *   POST /tickets/:id/messages         → addRequesterMessage
 *   POST /tickets/:id/reopen           → reopenTicket
 */
import {
  requesterAccess,
  requesters,
  statusEvents,
  ticketMessages,
  ticketState,
  tickets,
} from '../data/tickets';
import { ticketCategories } from '../data/catalog';
import type {
  MockAttachment,
  Requester,
  Ticket,
  TicketMessage,
  TicketStatus,
} from '../models/ticket';
import { clone, makeId, nowIso, simulateLatency } from '../lib/mock';

const BRAND = 'ggx';

export interface CreateTicketInput {
  name: string;
  email: string;
  mobile?: string;
  categoryId: string;
  subcategoryId?: string;
  subject: string;
  description: string;
  trackingNumber?: string;
  orderRef?: string;
  attachments?: MockAttachment[];
  relatedTransactionId?: string;
}

export interface CreateTicketResult {
  ticket: Ticket;
  reference: string;
  accessToken: string;
}

function nextReference(): string {
  ticketState.referenceSeq += 1;
  return `HQ-2026-${String(ticketState.referenceSeq).padStart(4, '0')}`;
}

/** Create a ticket: guest requester + routed, unassigned ticket in Open status. */
export async function createTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
  await simulateLatency();

  const category = ticketCategories.find((c) => c.id === input.categoryId);
  const teamId = category?.defaultTeamId ?? 'team-cs';
  const now = nowIso();

  const requester: Requester = {
    id: makeId('req'),
    name: input.name.trim(),
    email: input.email.trim(),
    mobile: input.mobile?.trim() || undefined,
    isGuest: true,
    brandId: BRAND,
  };
  requesters.push(requester);

  const reference = nextReference();
  const ticket: Ticket = {
    id: makeId('tkt'),
    reference,
    brandId: BRAND,
    requesterId: requester.id,
    subject: input.subject.trim(),
    description: input.description.trim(),
    categoryId: input.categoryId,
    subcategoryId: input.subcategoryId,
    // New -> Open: auto-routed to a team's unassigned queue on submit.
    status: 'open',
    escalationState: 'none',
    supportTier: 'L1',
    teamId,
    priority: 'normal',
    source: input.relatedTransactionId ? 'transaction' : 'web',
    relatedTransactionId: input.relatedTransactionId,
    slaPolicyId: 'sla-standard',
    createdAt: now,
    updatedAt: now,
  };
  tickets.push(ticket);

  statusEvents.push(
    { id: makeId('se'), ticketId: ticket.id, actor: 'requester', toStatus: 'new', timestamp: now },
    { id: makeId('se'), ticketId: ticket.id, actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: now },
  );

  ticketMessages.push(
    {
      id: makeId('msg'), ticketId: ticket.id, authorType: 'requester', authorId: requester.id,
      authorName: requester.name, body: input.description.trim(), channel: 'web', visibility: 'public', createdAt: now,
    },
    {
      id: makeId('msg'), ticketId: ticket.id, authorType: 'system', authorId: 'system',
      authorName: 'HeyQ', body: `Ticket ${reference} received. We'll get back to you shortly.`,
      channel: 'web', visibility: 'public', createdAt: now,
    },
  );

  const accessToken = makeId('tok');
  requesterAccess.push({ ticketId: ticket.id, accessToken, issuedAt: now });

  return { ticket: clone(ticket), reference, accessToken };
}

export async function getTicketById(id: string): Promise<Ticket | null> {
  await simulateLatency();
  return clone(tickets.find((t) => t.id === id) ?? null);
}

/** Public conversation for a ticket (chronological). Internal notes are excluded by type. */
export async function listMessages(ticketId: string): Promise<TicketMessage[]> {
  await simulateLatency();
  return clone(
    ticketMessages
      .filter((m) => m.ticketId === ticketId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
  );
}

function transition(ticket: Ticket, to: TicketStatus, actor: string, note?: string) {
  const now = nowIso();
  statusEvents.push({ id: makeId('se'), ticketId: ticket.id, actor, fromStatus: ticket.status, toStatus: to, note, timestamp: now });
  ticket.status = to;
  ticket.updatedAt = now;
}

/** Requester posts a public reply. Pending Requester resumes work; Resolved reopens. */
export async function addRequesterMessage(ticketId: string, body: string): Promise<TicketMessage> {
  await simulateLatency();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  const requester = requesters.find((r) => r.id === ticket.requesterId);
  const now = nowIso();

  const message: TicketMessage = {
    id: makeId('msg'), ticketId, authorType: 'requester', authorId: ticket.requesterId,
    authorName: requester?.name ?? 'Requester', body: body.trim(), channel: 'web', visibility: 'public', createdAt: now,
  };
  ticketMessages.push(message);
  ticket.updatedAt = now;

  if (ticket.status === 'pending_requester') transition(ticket, 'in_progress', 'requester', 'Requester replied');
  else if (ticket.status === 'resolved') transition(ticket, 'reopened', 'requester', 'Requester replied after resolution');

  return clone(message);
}

/** Requester reopens a resolved/closed ticket. */
export async function reopenTicket(ticketId: string): Promise<Ticket> {
  await simulateLatency();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  if (ticket.status === 'resolved' || ticket.status === 'closed') {
    transition(ticket, 'reopened', 'requester', 'Reopened by requester');
  }
  return clone(ticket);
}
