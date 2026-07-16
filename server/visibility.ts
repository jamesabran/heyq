/**
 * Customer visibility + authorization policy. ENFORCED HERE, on the server.
 *
 * The customer app (GGX Business+) never decides what it may see; it asks, and
 * this module answers. A ticket is exposed to a customer only when HeyQ has
 * explicitly said it may be — never because it happens to reference the same
 * order, the same tracking number, or the same account.
 *
 * ── The rules ──────────────────────────────────────────────────────────────
 *  1. A ticket submitted through Business+ by the signed-in requester is visible
 *     to that requester.
 *  2. A ticket raised directly in HeyQ is NOT automatically visible — it has no
 *     Business+ identity attached, so there is nobody to show it to.
 *  3. Agent-created, system-created, investigation and internal-only tickets are
 *     hidden by default (`customerVisible: false`).
 *  4. A proactive ticket is exposed only when explicitly marked customerVisible
 *     AND scoped to the right requester or account.
 *  5. An exposed proactive ticket is flagged `openedBySupport` so the customer app
 *     can label it. It is never presented as though the customer submitted it.
 *  6. Internal notes, agent identity, SLA, escalation state and support tier are
 *     dropped by the projection below — they cannot reach a customer response.
 *  7. Public replies and customer-visible status are returned.
 *  8. Order ownership is NOT authorization. Note that nothing in this file so
 *     much as reads `linkedOrder` when deciding visibility.
 */
import {
  CONCERN_TYPE_LABELS,
  type CustomerTicket,
  type CustomerTicketMessage,
  type Ticket,
  type TicketMessage,
} from '../src/app/models/ticket.ts';
import type { Store } from './store.ts';

/** The authenticated Business+ caller. In production this comes from a signed token. */
export interface RequesterIdentity {
  externalUserId: string;
  externalOrgId: string;
}

/**
 * May this customer see this ticket?
 *
 * Deliberately reads only provenance + visibility metadata. It never consults the
 * linked order, so "it's my order" can never become "it's my ticket".
 */
export function isVisibleToRequester(ticket: Ticket, who: RequesterIdentity): boolean {
  // Rules 2, 3: not marked visible → never exposed, whatever else is true.
  if (!ticket.customerVisible) return false;

  // A ticket with no external identity has no customer to belong to.
  if (!ticket.requesterExternalOrgId) return false;

  // Account scope must match.
  if (ticket.requesterExternalOrgId !== who.externalOrgId) return false;

  // Rule 4: account-wide tickets are visible to everyone in the account;
  // otherwise only to the specific requester it belongs to.
  if (ticket.accountVisible) return true;
  return ticket.requesterExternalUserId === who.externalUserId;
}

/** Rule 5: support opened it, not the customer. */
export const isOpenedBySupport = (ticket: Ticket): boolean =>
  ticket.creatorType !== 'requester';

/**
 * Project a ticket down to what a customer may see.
 *
 * This function IS the privacy boundary. Everything agent-only — assigneeId,
 * escalationState, supportTier, slaPolicyId, teamId, reporterId, internal notes,
 * status events — is absent from the output by construction, because
 * `CustomerTicket` has nowhere to put it.
 */
export function toCustomerTicket(
  ticket: Ticket,
  store: Store,
  teamNameOf: (teamId: string) => string,
): CustomerTicket {
  const supportTeam = teamNameOf(ticket.teamId);

  const messages: CustomerTicketMessage[] = store.ticketMessages
    .filter((m) => m.ticketId === ticket.id && m.visibility === 'public')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((m) => toCustomerMessage(m, supportTeam));

  return {
    id: ticket.id,
    reference: ticket.reference,
    subject: ticket.subject,
    concernType: ticket.concernType,
    issueType: ticket.concernType ? CONCERN_TYPE_LABELS[ticket.concernType] : 'Support request',
    status: ticket.status,
    priority: ticket.priority,
    supportTeam,
    createdAt: ticket.createdAt,
    updatedAt: ticket.updatedAt,
    resolvedAt: ticket.resolvedAt,
    reopenedAt: ticket.reopenedAt,
    openedBySupport: isOpenedBySupport(ticket),
    linkedOrder: ticket.linkedOrder,
    messages,
    canReopen: ticket.status === 'resolved' || ticket.status === 'closed',
  };
}

/**
 * Public messages only, with the author reduced to a role + the handling team.
 * An agent's real name never crosses this line. Attachments on a public message
 * are safe to include (they were shared on that public message); internal-note
 * attachments never reach here because notes are a separate type entirely.
 *
 * Exported so the realtime channel projects a live `message.created` to customer
 * subscribers exactly the way the REST read does — one projection, no drift.
 */
export function toCustomerMessage(m: TicketMessage, supportTeam: string): CustomerTicketMessage {
  const attachments = m.attachments;
  if (m.authorType === 'requester') {
    return { id: m.id, from: 'you', authorLabel: 'You', body: m.body, attachments, createdAt: m.createdAt };
  }
  if (m.authorType === 'system') {
    return { id: m.id, from: 'system', authorLabel: 'HeyQ', body: m.body, attachments, createdAt: m.createdAt };
  }
  return { id: m.id, from: 'support', authorLabel: supportTeam, body: m.body, attachments, createdAt: m.createdAt };
}
