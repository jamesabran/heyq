/**
 * ticketService — thin HTTP client over the HeyQ mock API server
 * (server/tickets.ts). HeyQ is the sole owner of ticket state (M23/M24): this
 * file no longer mutates any browser-side store — every function is a fetch
 * call. Signatures are unchanged from the pre-M23 version, so every caller
 * (pages, components, tests) needed no edits.
 *
 * Endpoints (server/http.ts):
 *   POST /tickets                      → createTicket
 *   POST /tickets/internal             → createInternalTicket
 *   GET  /tickets/:id                  → getTicketById
 *   GET  /tickets/:id/messages         → listMessages
 *   POST /tickets/:id/messages         → addRequesterMessage
 *   POST /tickets/:id/reopen           → reopenTicket
 *   POST /tickets/:id/hold             → holdTicket
 *   POST /tickets/:id/resume           → resumeTicket
 *   GET  /tickets                      → listTickets
 *   GET  /tickets/:id/detail           → getTicketDetail
 *   POST /tickets/:id/agent-reply      → addAgentReply
 *   POST /tickets/:id/notes            → addInternalNote
 *   POST /tickets/:id/resolve          → resolveTicket
 *   POST /tickets/:id/assign           → assignTicket
 *   POST /tickets/:id/claim            → claimTicket
 *   POST /tickets/:id/reclassify       → reclassifyTicket
 *   POST /tickets/:id/escalate         → escalateTicket
 *   POST /tickets/:id/deescalate       → deescalateTicket
 *   POST /tickets/:id/link-transaction → linkTransaction
 */
import { relatedTransactions } from '../data/catalog';
import type {
  ConcernType,
  EscalationReason,
  HoldReason,
  InternalNote,
  MockAttachment,
  ResolutionType,
  Ticket,
  TicketDetailView,
  TicketListItem,
  TicketMessage,
  TicketPriority,
  TicketStatus,
} from '../models/ticket';
import { ApiError, apiGet, apiPost, buildQuery } from '../lib/apiClient';
import type { OrderProviderIdentity } from './orderProvider';

export interface CreateTicketInput {
  name: string;
  email: string;
  mobile?: string;
  categoryId: string;
  subcategoryId?: string;
  concernType?: ConcernType;
  subject: string;
  description: string;
  trackingNumber?: string;
  orderRef?: string;
  attachments?: MockAttachment[];
  relatedTransactionId?: string;
  /** Reuse an existing requester (an authenticated customer) instead of creating a guest. */
  requesterId?: string;
  /**
   * Link a GGX Business+ order (M22). Authorization + snapshot capture happen
   * server-side — the identity must be allowed to see the order or creation fails.
   */
  businessPlusOrder?: {
    identity: OrderProviderIdentity;
    externalOrderId: string;
  };
}

export interface CreateTicketResult {
  ticket: Ticket;
  reference: string;
  accessToken: string;
}

export async function createTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
  return apiPost<CreateTicketResult>('/tickets', input);
}

export interface CreateInternalTicketInput {
  reporterId: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterMobile?: string;
  requesterNotificationsEnabled?: boolean;
  categoryId: string;
  subcategoryId?: string;
  concernType?: ConcernType;
  subject: string;
  description: string;
  priority: TicketPriority;
  teamId?: string;
  assigneeId?: string;
  relatedTransactionId?: string;
  internalNote?: string;
  attachments?: MockAttachment[];
}

export async function createInternalTicket(input: CreateInternalTicketInput): Promise<CreateTicketResult> {
  return apiPost<CreateTicketResult>('/tickets/internal', input);
}

export async function getTicketById(id: string): Promise<Ticket | null> {
  try {
    return await apiGet<Ticket>(`/tickets/${id}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function listMessages(ticketId: string): Promise<TicketMessage[]> {
  return apiGet<TicketMessage[]>(`/tickets/${ticketId}/messages`);
}

export async function addRequesterMessage(ticketId: string, body: string): Promise<TicketMessage> {
  return apiPost<TicketMessage>(`/tickets/${ticketId}/messages`, { body });
}

export async function reopenTicket(ticketId: string): Promise<Ticket> {
  return apiPost<Ticket>(`/tickets/${ticketId}/reopen`);
}

export async function holdTicket(ticketId: string, agentId: string, reason: HoldReason, note?: string): Promise<Ticket> {
  return apiPost<Ticket>(`/tickets/${ticketId}/hold`, { agentId, reason, note });
}

export async function resumeTicket(ticketId: string, agentId: string): Promise<Ticket> {
  return apiPost<Ticket>(`/tickets/${ticketId}/resume`, { agentId });
}

// ── Agent workspace ──────────────────────────────────────────────────────────

export type TicketQueue = 'mine' | 'team' | 'unassigned' | 'escalated' | 'sla' | 'all';

export interface ListTicketsParams {
  queue?: TicketQueue;
  viewerId?: string;
  viewerTeamId?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  reopened?: boolean;
  requesterId?: string;
  search?: string;
  sort?: 'updated' | 'created' | 'priority';
}

/**
 * The GGX tracking number for a ticket: from its Business+ linked-order snapshot
 * first (self-sufficient even when the provider is down), then the M13 linked
 * transaction. Pure/synchronous — `relatedTransactions` is reference data that
 * stays client-side (it isn't ticket state).
 */
export const trackingNumberFor = (ticket: Ticket): string | undefined =>
  ticket.linkedOrder?.trackingNumber ??
  (ticket.relatedTransactionId
    ? relatedTransactions.find((t) => t.id === ticket.relatedTransactionId)?.trackingNumber
    : undefined);

export async function listTickets(params: ListTicketsParams = {}): Promise<TicketListItem[]> {
  const { reopened, ...rest } = params;
  return apiGet<TicketListItem[]>(`/tickets${buildQuery({ ...rest, reopened: reopened ? '1' : undefined })}`);
}

export async function getTicketDetail(ticketId: string): Promise<TicketDetailView | null> {
  try {
    return await apiGet<TicketDetailView>(`/tickets/${ticketId}/detail`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

export async function addAgentReply(ticketId: string, agentId: string, body: string, attachments?: MockAttachment[]): Promise<TicketMessage> {
  return apiPost<TicketMessage>(`/tickets/${ticketId}/agent-reply`, { agentId, body, attachments });
}

export async function addInternalNote(ticketId: string, agentId: string, body: string, attachments?: MockAttachment[]): Promise<InternalNote> {
  return apiPost<InternalNote>(`/tickets/${ticketId}/notes`, { agentId, body, attachments });
}

export async function resolveTicket(
  ticketId: string,
  agentId: string,
  resolutionType: ResolutionType,
  note?: string,
): Promise<Ticket> {
  return apiPost<Ticket>(`/tickets/${ticketId}/resolve`, { agentId, resolutionType, note });
}

// ── Assignment, classification & escalation (M6) ─────────────────────────────

export async function assignTicket(ticketId: string, actor: string, toAssigneeId?: string): Promise<Ticket> {
  return apiPost<Ticket>(`/tickets/${ticketId}/assign`, { actor, toAssigneeId });
}

export async function claimTicket(ticketId: string, agentId: string): Promise<Ticket> {
  return apiPost<Ticket>(`/tickets/${ticketId}/claim`, { agentId });
}

export interface ReclassifyChanges {
  categoryId?: string;
  subcategoryId?: string;
  concernType?: ConcernType;
  priority?: TicketPriority;
  reroute?: boolean;
}

export async function reclassifyTicket(ticketId: string, actor: string, changes: ReclassifyChanges): Promise<Ticket> {
  return apiPost<Ticket>(`/tickets/${ticketId}/reclassify`, { actor, ...changes });
}

export interface EscalateInput {
  reason: EscalationReason;
  note: string;
  toTeamId?: string;
  toAssigneeId?: string;
}

export async function escalateTicket(ticketId: string, actor: string, input: EscalateInput): Promise<Ticket> {
  return apiPost<Ticket>(`/tickets/${ticketId}/escalate`, { actor, ...input });
}

export async function linkTransaction(ticketId: string, transactionId?: string): Promise<Ticket> {
  return apiPost<Ticket>(`/tickets/${ticketId}/link-transaction`, { transactionId });
}

export async function deescalateTicket(ticketId: string, actor: string, note: string, toTeamId?: string): Promise<Ticket> {
  return apiPost<Ticket>(`/tickets/${ticketId}/deescalate`, { actor, note, toTeamId });
}
