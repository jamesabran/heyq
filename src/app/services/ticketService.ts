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
import { agents, teams, ticketCategories } from '../data/catalog';
import {
  ESCALATION_REASON_LABELS,
  STATUS_LABELS,
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
import { clone, makeId, nowIso, simulateLatency } from '../lib/mock';

const BRAND = 'ggx';

const agentName = (id?: string) => agents.find((a) => a.id === id)?.name;
const teamName = (id: string) => teams.find((t) => t.id === id)?.name ?? 'Unassigned';
const categoryName = (id: string) => ticketCategories.find((c) => c.id === id)?.name ?? 'Uncategorized';
const requesterName = (id: string) => requesters.find((r) => r.id === id)?.name ?? 'Requester';

const PRIORITY_RANK: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };

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

// ── Agent workspace ──────────────────────────────────────────────────────────

export type TicketQueue = 'mine' | 'team' | 'unassigned' | 'escalated' | 'sla' | 'all';

export interface ListTicketsParams {
  queue?: TicketQueue;
  /** Signed-in agent id (for the "mine" queue). */
  viewerId?: string;
  /** Signed-in agent's team; undefined = see all teams (e.g. admin). */
  viewerTeamId?: string;
  status?: TicketStatus;
  search?: string;
  sort?: 'updated' | 'created' | 'priority';
}

function toListItem(ticket: Ticket): TicketListItem {
  return {
    ticket: clone(ticket),
    requesterName: requesterName(ticket.requesterId),
    teamName: teamName(ticket.teamId),
    categoryName: categoryName(ticket.categoryId),
    assigneeName: agentName(ticket.assigneeId),
    sla: computeSlaSummary(ticket),
  };
}

/** Filtered, sorted ticket list for an agent queue. */
export async function listTickets(params: ListTicketsParams = {}): Promise<TicketListItem[]> {
  await simulateLatency();
  const { queue = 'all', viewerId, viewerTeamId, status, search, sort = 'updated' } = params;
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
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    result = result.filter((t) =>
      `${t.reference} ${t.subject} ${requesterName(t.requesterId)}`.toLowerCase().includes(q),
    );
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
  return clone(ticket);
}

/** Claim a ticket for the acting agent. */
export async function claimTicket(ticketId: string, agentId: string): Promise<Ticket> {
  return assignTicket(ticketId, agentId, agentId);
}

export interface ReclassifyChanges {
  categoryId?: string;
  subcategoryId?: string;
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
  // Note: status deliberately not changed.
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
