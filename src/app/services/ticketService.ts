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
  assignments,
  escalations,
  internalNotes,
  requesterAccess,
  requesters,
  statusEvents,
  ticketMessages,
  ticketState,
  tickets,
} from '../data/tickets';
import { agents, relatedTransactions, teams, ticketCategories } from '../data/catalog';
import {
  CONCERN_TYPE_LABELS,
  ESCALATION_REASON_LABELS,
  HOLD_REASON_LABELS,
  STATUS_LABELS,
  type ConcernType,
  type ExternalSourceSystem,
  type HoldReason,
  type LinkedOrder,
  type EscalationReason,
  type InternalNote,
  type MockAttachment,
  type Requester,
  type ResolutionType,
  type Ticket,
  type TicketDetailView,
  type TicketListItem,
  type TicketMessage,
  type TicketPriority,
  type TicketStatus,
  type TimelineEvent,
} from '../models/ticket';
import { computeSlaSummary, isSlaAtRiskOrBreached } from './slaService';
import { getOrderProvider, type OrderProviderIdentity } from './orderProvider';
import { emit } from './notificationService';
import { clone, makeId, nowIso, simulateLatency } from '../lib/mock';

const BRAND = 'ggx';

const agentName = (id?: string) => agents.find((a) => a.id === id)?.name;
const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? 'Unassigned';
const categoryName = (id: string) => ticketCategories.find((c) => c.id === id)?.name ?? 'Uncategorized';
const requesterName = (id: string) => requesters.find((r) => r.id === id)?.name ?? 'Requester';

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2 };

// Default Concern Type by category (M15). Concern Type stays a SEPARATE field —
// this only seeds a sensible starting value that agents can reclassify.
const DEFAULT_CONCERN_BY_CATEGORY: Record<string, ConcernType> = {
  'cat-general': 'general_inquiry',
  'cat-account': 'account_concern',
  'cat-disbursal': 'remittance_concern',
  'cat-claims': 'missing_parcel',
  'cat-delivery': 'delivery_delay',
  'cat-pickup': 'pickup_issue',
  'cat-payment': 'payment_issue',
  'cat-cod': 'cod_concern',
  'cat-returns': 'general_inquiry',
  'cat-technical': 'general_inquiry',
  'cat-other': 'general_inquiry',
};

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
   * Link a GGX Business+ order (M22). Authorization + snapshot capture happen at
   * this boundary, not in the form — the identity must be allowed to see the
   * order or creation fails.
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

function nextReference(): string {
  ticketState.referenceSeq += 1;
  return `HQ-2026-${String(ticketState.referenceSeq).padStart(4, '0')}`;
}

/**
 * Whether requester-facing communication should fire for a ticket. Non-internal
 * tickets notify by default; internal tickets only when explicitly enabled
 * (product rule #18).
 */
function requesterNotificationsOn(ticket: Ticket): boolean {
  if (ticket.source === 'internal') return ticket.requesterNotificationsEnabled === true;
  return ticket.requesterNotificationsEnabled !== false;
}

/** Create a ticket: guest requester + routed, unassigned ticket in Open status. */
export async function createTicket(input: CreateTicketInput): Promise<CreateTicketResult> {
  await simulateLatency();

  const category = ticketCategories.find((c) => c.id === input.categoryId);
  const teamId = category?.defaultTeamId ?? 'team-cs';
  const now = nowIso();

  // Resolve the Business+ order BEFORE creating anything: an unauthorized or
  // unresolvable link must fail the whole submission, never half-create a ticket.
  let sourceSystem: ExternalSourceSystem | undefined;
  let linkedOrder: LinkedOrder | undefined;
  if (input.businessPlusOrder) {
    const res = await getOrderProvider().getAuthorizedOrder(
      input.businessPlusOrder.identity,
      input.businessPlusOrder.externalOrderId,
    );
    if (res.status === 'unavailable') {
      throw new Error('GGX Business+ is unreachable right now. Try again, or submit without linking the order.');
    }
    if (res.status !== 'ok') {
      throw new Error('This order is not available on your account, so it cannot be linked.');
    }
    sourceSystem = 'ggx_business_plus';
    linkedOrder = {
      externalOrderId: res.order.externalOrderId,
      trackingNumber: res.order.trackingNumber,
      capturedAt: now,
      snapshot: {
        shipmentStatus: res.order.shipmentStatus,
        bookingDate: res.order.bookingDate,
        senderSummary: res.order.senderSummary,
        recipientSummary: res.order.recipientSummary,
        destination: res.order.destination,
      },
    };
  }

  // An authenticated customer reuses their requester record so the ticket shows
  // up in their portal history; anonymous submissions stay guests.
  const existing = input.requesterId ? requesters.find((r) => r.id === input.requesterId) : undefined;
  const requester: Requester = existing ?? {
    id: makeId('req'),
    name: input.name.trim(),
    email: input.email.trim(),
    mobile: input.mobile?.trim() || undefined,
    isGuest: true,
    brandId: BRAND,
  };
  if (!existing) requesters.push(requester);

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
    concernType: input.concernType ?? DEFAULT_CONCERN_BY_CATEGORY[input.categoryId],
    // New -> Open: auto-routed to a team's unassigned queue on submit.
    status: 'open',
    escalationState: 'none',
    supportTier: 'L1',
    teamId,
    priority: 'normal',
    source: input.relatedTransactionId ? 'transaction' : 'web',
    relatedTransactionId: input.relatedTransactionId,
    sourceSystem,
    linkedOrder,
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

export interface CreateInternalTicketInput {
  /** Submitting employee (agent id) — recorded in audit history. */
  reporterId: string;
  /** External customer, when there is one. Omit for a purely internal report. */
  requesterName?: string;
  requesterEmail?: string;
  requesterMobile?: string;
  /** Only meaningful when an external requester is attached (rule #18). */
  requesterNotificationsEnabled?: boolean;
  categoryId: string;
  subcategoryId?: string;
  concernType?: ConcernType;
  subject: string;
  description: string;
  priority: TicketPriority;
  /** Explicit owning team; falls back to the category's default team. */
  teamId?: string;
  assigneeId?: string;
  relatedTransactionId?: string;
  internalNote?: string;
  attachments?: MockAttachment[];
}

/**
 * Create an INTERNAL ticket (M16). Same native ticket model + seven-status
 * lifecycle as any other ticket — only `source: 'internal'` and the
 * communication config differ (no separate model — product rule #17). Requester
 * notifications default OFF for purely internal tickets; they are on only when an
 * external requester is attached AND the agent opts in (rule #18). The creator is
 * recorded in the status/audit history.
 */
export async function createInternalTicket(input: CreateInternalTicketInput): Promise<CreateTicketResult> {
  await simulateLatency();

  const now = nowIso();
  const hasExternalRequester = Boolean(input.requesterName?.trim());
  const reporter = agents.find((a) => a.id === input.reporterId);

  // Build the requester record. With an external customer we capture them as a
  // guest; for a purely internal report we synthesize a non-guest "internal"
  // requester so the ticket has a subject line without implying an outside party.
  const requester: Requester = hasExternalRequester
    ? {
        id: makeId('req'), name: input.requesterName!.trim(),
        email: input.requesterEmail?.trim() ?? '', mobile: input.requesterMobile?.trim() || undefined,
        isGuest: true, brandId: BRAND,
      }
    : {
        id: makeId('req'), name: `Internal report — ${reporter?.name ?? 'Staff'}`,
        email: '', isGuest: false, brandId: BRAND,
      };
  requesters.push(requester);

  // Notifications OFF by default; only ON when external + explicitly enabled.
  const requesterNotificationsEnabled = hasExternalRequester
    ? Boolean(input.requesterNotificationsEnabled)
    : false;

  const category = ticketCategories.find((c) => c.id === input.categoryId);
  const teamId = input.teamId ?? category?.defaultTeamId ?? 'team-cs';
  const reference = nextReference();

  const ticket: Ticket = {
    id: makeId('tkt'), reference, brandId: BRAND, requesterId: requester.id,
    subject: input.subject.trim(), description: input.description.trim(),
    categoryId: input.categoryId, subcategoryId: input.subcategoryId,
    concernType: input.concernType ?? DEFAULT_CONCERN_BY_CATEGORY[input.categoryId],
    status: 'open', escalationState: 'none', supportTier: 'L1', teamId,
    priority: input.priority, source: 'internal',
    reporterId: input.reporterId, requesterNotificationsEnabled,
    assigneeId: input.assigneeId, relatedTransactionId: input.relatedTransactionId,
    slaPolicyId: 'sla-standard', createdAt: now, updatedAt: now,
  };
  tickets.push(ticket);

  // Audit: creation is attributed to the reporter (who created it).
  statusEvents.push(
    { id: makeId('se'), ticketId: ticket.id, actor: input.reporterId, toStatus: 'new', note: 'Internal ticket created', timestamp: now },
    { id: makeId('se'), ticketId: ticket.id, actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: now },
  );

  // The concern description seeds the thread as a message from the reporter.
  ticketMessages.push({
    id: makeId('msg'), ticketId: ticket.id, authorType: 'agent', authorId: input.reporterId,
    authorName: reporter?.name ?? 'Staff', body: input.description.trim(), channel: 'web', visibility: 'public', createdAt: now,
  });

  if (input.internalNote?.trim()) {
    internalNotes.push({
      id: makeId('note'), ticketId: ticket.id, agentId: input.reporterId,
      agentName: reporter?.name ?? 'Staff', body: input.internalNote.trim(), createdAt: now,
    });
  }

  if (input.assigneeId) {
    assignments.push({
      id: makeId('asg'), ticketId: ticket.id, actor: input.reporterId,
      toAssigneeId: input.assigneeId, toTeamId: teamId, timestamp: now,
    });
    emit({ recipientId: input.assigneeId, event: 'ticket_assigned', title: `Assigned: ${ticket.subject}`, ticketId: ticket.id, ticketRef: ticket.reference });
  }

  // A portal access token is still issued (usable only if requester comms are on).
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
  // A hold reason only means something while the ticket is on hold.
  if (to !== 'on_hold') ticket.holdReason = undefined;
  ticket.updatedAt = now;
}

/**
 * Reopen: an EVENT, not a status. A resolved/closed ticket returns to active work
 * — `in_progress` if someone still owns it, otherwise `open` — and is stamped with
 * `reopenedAt` so queues and the Overview can still single reopened work out.
 */
function reopen(ticket: Ticket, actor: string, note: string) {
  const back: TicketStatus = ticket.assigneeId ? 'in_progress' : 'open';
  transition(ticket, back, actor, note);
  ticket.reopenedAt = ticket.updatedAt;
  // The resolution is no longer the ticket's outcome.
  ticket.resolvedAt = undefined;
  ticket.resolutionType = undefined;
}

const isClosedOut = (t: Ticket) => t.status === 'resolved' || t.status === 'closed';

/** Requester posts a public reply. A hold on them lifts; a closed-out ticket reopens. */
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

  if (ticket.status === 'on_hold' && ticket.holdReason === 'waiting_requester') {
    // The thing we were waiting for just arrived — the hold is over.
    transition(ticket, 'in_progress', 'requester', 'Requester replied');
  } else if (isClosedOut(ticket)) {
    reopen(ticket, 'requester', 'Requester replied after resolution');
  }

  if (ticket.assigneeId) {
    emit({ recipientId: ticket.assigneeId, event: 'requester_replied', title: `New reply from ${requester?.name ?? 'requester'}`, ticketId: ticket.id, ticketRef: ticket.reference });
  }
  return clone(message);
}

/** Requester reopens a resolved/closed ticket. */
export async function reopenTicket(ticketId: string): Promise<Ticket> {
  await simulateLatency();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  if (isClosedOut(ticket)) reopen(ticket, 'requester', 'Reopened by requester');
  return clone(ticket);
}

/** Agent puts a ticket on hold, naming what it is blocked on. */
export async function holdTicket(ticketId: string, agentId: string, reason: HoldReason, note?: string): Promise<Ticket> {
  await simulateLatency();
  const ticket = requireTicket(ticketId);
  ticket.holdReason = reason;
  transition(ticket, 'on_hold', agentId, note ?? HOLD_REASON_LABELS[reason]);
  return clone(ticket);
}

/** Agent takes a ticket off hold and resumes work on it. */
export async function resumeTicket(ticketId: string, agentId: string): Promise<Ticket> {
  await simulateLatency();
  const ticket = requireTicket(ticketId);
  if (ticket.status === 'on_hold') transition(ticket, 'in_progress', agentId, 'Resumed from hold');
  return clone(ticket);
}

// ── Agent workspace ──────────────────────────────────────────────────────────

export type TicketQueue = 'mine' | 'team' | 'unassigned' | 'escalated' | 'sla' | 'all';

export interface ListTicketsParams {
  queue?: TicketQueue;
  /** Signed-in agent id (for the "mine" queue). */
  viewerId?: string;
  /** Signed-in agent's team; undefined = see all teams (e.g. admin). */
  viewerTeamId?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  /** Reopened is a flag, not a status — filter on it separately. */
  reopened?: boolean;
  /** Narrow to one requester's own tickets (the customer's Overview, M19). */
  requesterId?: string;
  search?: string;
  sort?: 'updated' | 'created' | 'priority';
}

/**
 * The GGX tracking number for a ticket: from its Business+ linked-order snapshot
 * first (self-sufficient even when the provider is down), then the M13 linked
 * transaction. Exported so requester-facing lists resolve it identically.
 */
export const trackingNumberFor = (ticket: Ticket): string | undefined =>
  ticket.linkedOrder?.trackingNumber ??
  (ticket.relatedTransactionId
    ? relatedTransactions.find((t) => t.id === ticket.relatedTransactionId)?.trackingNumber
    : undefined);

function toListItem(ticket: Ticket): TicketListItem {
  return {
    ticket: clone(ticket),
    requesterName: requesterName(ticket.requesterId),
    teamName: teamName(ticket.teamId),
    categoryName: categoryName(ticket.categoryId),
    assigneeName: agentName(ticket.assigneeId),
    trackingNumber: trackingNumberFor(ticket),
    sla: computeSlaSummary(ticket),
  };
}

/**
 * Everything one ticket can be matched on: reference, GGX tracking number, concern
 * type, subject, and the requester's name and email. Partial matches count — an
 * agent reading a tracking number off a chat types the middle group, not all 12
 * characters.
 */
function searchCorpus(ticket: Ticket): string {
  const requester = requesters.find((r) => r.id === ticket.requesterId);
  return [
    ticket.reference,
    trackingNumberFor(ticket),
    ticket.concernType ? CONCERN_TYPE_LABELS[ticket.concernType] : undefined,
    ticket.subject,
    requester?.name,
    requester?.email,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Filtered, sorted ticket list for an agent queue. */
export async function listTickets(params: ListTicketsParams = {}): Promise<TicketListItem[]> {
  await simulateLatency();
  const { queue = 'all', viewerId, viewerTeamId, status, priority, reopened, requesterId, search, sort = 'updated' } = params;
  const scoped = (t: Ticket) => viewerTeamId === undefined || t.teamId === viewerTeamId;

  let result = tickets.filter((t) => {
    switch (queue) {
      case 'mine':
        return t.assigneeId === viewerId;
      case 'team':
        return scoped(t);
      case 'unassigned':
        return !t.assigneeId && scoped(t);
      case 'escalated':
        return t.escalationState !== 'none' && scoped(t);
      case 'sla':
        return isSlaAtRiskOrBreached(t) && scoped(t);
      case 'all':
      default:
        return scoped(t);
    }
  });

  if (status) result = result.filter((t) => t.status === status);
  if (priority) result = result.filter((t) => t.priority === priority);
  if (reopened) result = result.filter((t) => Boolean(t.reopenedAt));
  if (requesterId) result = result.filter((t) => t.requesterId === requesterId);
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter((t) => searchCorpus(t).includes(q));
  }

  result = [...result].sort((a, b) => {
    if (sort === 'priority') return (PRIORITY_RANK[a.priority] ?? 9) - (PRIORITY_RANK[b.priority] ?? 9);
    if (sort === 'created') return b.createdAt.localeCompare(a.createdAt);
    return b.updatedAt.localeCompare(a.updatedAt);
  });

  return result.map(toListItem);
}

function buildTimeline(ticketId: string): TimelineEvent[] {
  const statusItems: TimelineEvent[] = statusEvents
    .filter((e) => e.ticketId === ticketId)
    .map((e) => ({
      id: e.id,
      type: 'status' as const,
      actor: agentName(e.actor) ?? e.actor,
      summary: e.fromStatus
        ? `Status changed ${STATUS_LABELS[e.fromStatus]} → ${STATUS_LABELS[e.toStatus]}`
        : `Ticket created (${STATUS_LABELS[e.toStatus]})`,
      timestamp: e.timestamp,
    }));

  const assignmentItems: TimelineEvent[] = assignments
    .filter((a) => a.ticketId === ticketId)
    .map((a) => ({
      id: a.id,
      type: 'assignment' as const,
      actor: agentName(a.actor) ?? a.actor,
      summary: a.toAssigneeId
        ? `Assigned to ${agentName(a.toAssigneeId) ?? a.toAssigneeId}`
        : 'Unassigned',
      timestamp: a.timestamp,
    }));

  const escalationItems: TimelineEvent[] = escalations
    .filter((e) => e.ticketId === ticketId)
    .map((e) => ({
      id: e.id,
      type: 'escalation' as const,
      actor: agentName(e.actor) ?? e.actor,
      summary:
        e.direction === 'escalate'
          ? `Escalated ${e.fromTier} → ${e.toTier}${e.reason ? ` (${ESCALATION_REASON_LABELS[e.reason as EscalationReason] ?? e.reason})` : ''}`
          : `Returned ${e.fromTier} → ${e.toTier}`,
      timestamp: e.timestamp,
    }));

  return [...statusItems, ...assignmentItems, ...escalationItems].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
}

/** Full agent detail view: context, public messages, internal notes, timeline, SLA. */
export async function getTicketDetail(ticketId: string): Promise<TicketDetailView | null> {
  await simulateLatency();
  const ticket = tickets.find((t) => t.id === ticketId);
  const requester = ticket && requesters.find((r) => r.id === ticket.requesterId);
  if (!ticket || !requester) return null;

  const category = ticketCategories.find((c) => c.id === ticket.categoryId);
  const subcategory = category?.subcategories.find((s) => s.id === ticket.subcategoryId);

  return clone({
    ticket,
    requester,
    teamName: teamName(ticket.teamId),
    categoryName: category?.name ?? 'Uncategorized',
    subcategoryName: subcategory?.name,
    assigneeName: agentName(ticket.assigneeId),
    messages: ticketMessages
      .filter((m) => m.ticketId === ticketId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    notes: internalNotes
      .filter((n) => n.ticketId === ticketId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    timeline: buildTimeline(ticketId),
    sla: computeSlaSummary(ticket),
  });
}

/** Agent posts a public reply. Sets first-response and moves New/Open into progress. */
export async function addAgentReply(ticketId: string, agentId: string, body: string): Promise<TicketMessage> {
  await simulateLatency();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  const now = nowIso();

  const message: TicketMessage = {
    id: makeId('msg'), ticketId, authorType: 'agent', authorId: agentId,
    authorName: agentName(agentId) ?? 'Support', body: body.trim(), channel: 'web', visibility: 'public', createdAt: now,
  };
  ticketMessages.push(message);
  ticket.updatedAt = now;
  if (!ticket.firstResponseAt) ticket.firstResponseAt = now;
  if (ticket.status === 'new' || ticket.status === 'open') transition(ticket, 'in_progress', agentId);

  // Requester notifications are off for internal tickets unless explicitly enabled
  // (rule #18); don't claim a reply was emailed when it wasn't.
  const notify = requesterNotificationsOn(ticket);
  emit({
    recipientId: agentId,
    event: 'reply_sent',
    title: notify ? `Reply emailed to requester on ${ticket.reference}` : `Reply added to ${ticket.reference} (requester notifications off)`,
    ticketId: ticket.id, ticketRef: ticket.reference, emailed: notify,
  });
  return clone(message);
}

/** Agent adds an internal note (never visible to requesters). */
export async function addInternalNote(ticketId: string, agentId: string, body: string): Promise<InternalNote> {
  await simulateLatency();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  const now = nowIso();
  const note: InternalNote = {
    id: makeId('note'), ticketId, agentId, agentName: agentName(agentId) ?? 'Agent', body: body.trim(), createdAt: now,
  };
  internalNotes.push(note);
  ticket.updatedAt = now;
  return clone(note);
}

/** Agent resolves a ticket with a resolution type. */
export async function resolveTicket(
  ticketId: string,
  agentId: string,
  resolutionType: ResolutionType,
  note?: string,
): Promise<Ticket> {
  await simulateLatency();
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  ticket.resolutionType = resolutionType;
  ticket.resolvedAt = nowIso();
  transition(ticket, 'resolved', agentId, note);
  const notify = requesterNotificationsOn(ticket);
  emit({
    recipientId: agentId,
    event: 'ticket_resolved',
    title: notify ? `Resolution emailed to requester on ${ticket.reference}` : `Resolved ${ticket.reference} (requester notifications off)`,
    ticketId: ticket.id, ticketRef: ticket.reference, emailed: notify,
  });
  return clone(ticket);
}

// ── Assignment, classification & escalation (M6) ─────────────────────────────

function recordAssignment(ticket: Ticket, actor: string, fromAssigneeId?: string, fromTeamId?: string) {
  assignments.push({
    id: makeId('asg'), ticketId: ticket.id, actor,
    fromAssigneeId, toAssigneeId: ticket.assigneeId, fromTeamId, toTeamId: ticket.teamId,
    timestamp: nowIso(),
  });
}

function requireTicket(ticketId: string): Ticket {
  const ticket = tickets.find((t) => t.id === ticketId);
  if (!ticket) throw new Error('Ticket not found');
  return ticket;
}

/** Assign (or reassign / unassign) a ticket; records assignment history. */
export async function assignTicket(ticketId: string, actor: string, toAssigneeId?: string): Promise<Ticket> {
  await simulateLatency();
  const ticket = requireTicket(ticketId);
  const from = ticket.assigneeId;
  ticket.assigneeId = toAssigneeId;
  ticket.updatedAt = nowIso();
  recordAssignment(ticket, actor, from);
  if (toAssigneeId && toAssigneeId !== from) {
    emit({ recipientId: toAssigneeId, event: 'ticket_assigned', title: `Assigned: ${ticket.subject}`, ticketId: ticket.id, ticketRef: ticket.reference });
  }
  return clone(ticket);
}

/** Claim a ticket for the acting agent. */
export async function claimTicket(ticketId: string, agentId: string): Promise<Ticket> {
  return assignTicket(ticketId, agentId, agentId);
}

export interface ReclassifyChanges {
  categoryId?: string;
  subcategoryId?: string;
  concernType?: ConcernType;
  priority?: TicketPriority;
  /** When true and the category changed, re-route to the new category's default team. */
  reroute?: boolean;
}

/** Update classification fields; optionally re-route the team on category change. */
export async function reclassifyTicket(ticketId: string, actor: string, changes: ReclassifyChanges): Promise<Ticket> {
  await simulateLatency();
  const ticket = requireTicket(ticketId);
  const categoryChanged = changes.categoryId !== undefined && changes.categoryId !== ticket.categoryId;

  if (changes.categoryId !== undefined) ticket.categoryId = changes.categoryId;
  if (changes.subcategoryId !== undefined) ticket.subcategoryId = changes.subcategoryId || undefined;
  if (changes.concernType !== undefined) ticket.concernType = changes.concernType;
  if (changes.priority !== undefined) ticket.priority = changes.priority;

  if (categoryChanged && changes.reroute) {
    const fromTeam = ticket.teamId;
    const category = ticketCategories.find((c) => c.id === ticket.categoryId);
    if (category && category.defaultTeamId !== fromTeam) {
      ticket.teamId = category.defaultTeamId;
      recordAssignment(ticket, actor, ticket.assigneeId, fromTeam);
    }
  }
  ticket.updatedAt = nowIso();
  return clone(ticket);
}

export interface EscalateInput {
  reason: EscalationReason;
  note: string;
  toTeamId?: string;
  toAssigneeId?: string;
}

/**
 * Escalate L1 → L2. Changes escalationState/tier/team/owner and appends escalation
 * + assignment history. The WORKFLOW STATUS IS UNCHANGED (product rule #2).
 */
export async function escalateTicket(ticketId: string, actor: string, input: EscalateInput): Promise<Ticket> {
  await simulateLatency();
  const ticket = requireTicket(ticketId);
  if (!input.note.trim()) throw new Error('An escalation note is required');

  const fromTeam = ticket.teamId;
  const fromAssignee = ticket.assigneeId;
  const toTeam = input.toTeamId ?? ticket.teamId;
  const now = nowIso();

  ticket.escalationState = 'escalated';
  ticket.supportTier = 'L2';
  ticket.teamId = toTeam;
  ticket.assigneeId = input.toAssigneeId; // undefined = lands in the L2 team's queue
  ticket.escalatedAt = now;
  ticket.updatedAt = now;

  escalations.push({
    id: makeId('esc'), ticketId, actor, direction: 'escalate',
    fromTier: 'L1', toTier: 'L2', fromTeamId: fromTeam, toTeamId: toTeam,
    reason: input.reason, note: input.note.trim(), timestamp: now,
  });
  recordAssignment(ticket, actor, fromAssignee, fromTeam);
  const escalationRecipient = input.toAssigneeId ?? actor;
  emit({ recipientId: escalationRecipient, event: 'ticket_escalated', title: `Escalated: ${ticket.subject}`, ticketId: ticket.id, ticketRef: ticket.reference });
  // Note: status deliberately not changed.
  return clone(ticket);
}

/**
 * Link (or unlink) a GGX transaction to a ticket as STRUCTURED context (product
 * rule #14) — stored as `relatedTransactionId`, never as description text. Records
 * an assignment-independent status/audit note on the timeline is out of scope; a
 * lightweight update to `updatedAt` is enough for the mock.
 */
export async function linkTransaction(ticketId: string, transactionId?: string): Promise<Ticket> {
  await simulateLatency();
  const ticket = requireTicket(ticketId);
  ticket.relatedTransactionId = transactionId || undefined;
  ticket.updatedAt = nowIso();
  return clone(ticket);
}

/** De-escalate L2 → L1, returning the ticket to first line. */
export async function deescalateTicket(ticketId: string, actor: string, note: string, toTeamId?: string): Promise<Ticket> {
  await simulateLatency();
  const ticket = requireTicket(ticketId);
  const fromTeam = ticket.teamId;
  const toTeam = toTeamId ?? ticket.teamId;
  const now = nowIso();

  ticket.escalationState = 'returned_to_l1';
  ticket.supportTier = 'L1';
  ticket.teamId = toTeam;
  ticket.updatedAt = now;

  escalations.push({
    id: makeId('esc'), ticketId, actor, direction: 'de-escalate',
    fromTier: 'L2', toTier: 'L1', fromTeamId: fromTeam, toTeamId: toTeam,
    note: note.trim() || 'Returned to L1', timestamp: now,
  });
  return clone(ticket);
}
