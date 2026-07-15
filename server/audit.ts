/**
 * audit — server-side port of the TICKET-DERIVED half of
 * src/app/services/auditService.ts (status/assignment/escalation/note
 * histories). KB entries are NOT included here — KB stays client-side (it
 * isn't ticket state), and the client's auditService.ts merges this server
 * slice with its own local KB-derived entries under the original
 * `listAuditEntries`/`listAuditActors` names.
 *
 * Records what was done, by whom, and when — never the content of an internal
 * note (product rule #5 keeps note bodies out of the trail).
 *
 * HTTP surface:
 *   GET /audit/tickets?category=&actor=&q=   → listTicketAuditEntries
 *   GET /audit/tickets/actors                → listTicketAuditActors
 */
import { agents, teams } from '../src/app/data/catalog.ts';
import { ROLE_LABELS, type Role } from '../src/app/lib/roles.ts';
import { ESCALATION_REASON_LABELS, STATUS_LABELS, type EscalationReason } from '../src/app/models/ticket.ts';
import { clone, simulateLatency } from '../src/app/lib/mock.ts';
import { getStore, type Store } from './store.ts';

export type AuditCategory = 'ticket' | 'assignment' | 'escalation' | 'note';

export interface AuditEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  category: AuditCategory;
  /** What happened — the action, not the payload. */
  action: string;
  ticketId?: string;
  ticketRef?: string;
}

export interface ListAuditParams {
  category?: AuditCategory;
  actorId?: string;
  /** Matches the ticket reference, actor, or action text. */
  search?: string;
}

export interface AuditActor {
  id: string;
  name: string;
}

const ticketRef = (store: Store, id: string) => store.tickets.find((t) => t.id === id)?.reference;
const teamName = (id?: string) => teams.find((t) => t.id === id)?.name ?? id;

/**
 * Resolve an actor id to a display name. Most actors are support agents, but
 * the trail also carries the two non-human actors the seed uses (system,
 * requester). Fall back to the role label rather than leaking a raw id.
 */
function actorName(id: string): string {
  if (id === 'system') return 'System';
  if (id === 'requester') return 'Requester';
  const agent = agents.find((a) => a.id === id);
  if (agent) return agent.name;
  return id in ROLE_LABELS ? ROLE_LABELS[id as Role] : id;
}

function statusEntries(store: Store): AuditEntry[] {
  return store.statusEvents.map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    actorId: e.actor,
    actorName: actorName(e.actor),
    category: 'ticket' as const,
    action: e.fromStatus
      ? `Status changed ${STATUS_LABELS[e.fromStatus]} → ${STATUS_LABELS[e.toStatus]}`
      : `Ticket created (${STATUS_LABELS[e.toStatus]})`,
    ticketId: e.ticketId,
    ticketRef: ticketRef(store, e.ticketId),
  }));
}

function assignmentEntries(store: Store): AuditEntry[] {
  return store.assignments.map((a) => {
    // A re-route (team change with no new assignee) is recorded as an assignment
    // too — say so, rather than reporting a misleading "Unassigned".
    const rerouted = a.fromTeamId && a.toTeamId && a.fromTeamId !== a.toTeamId;
    const action = a.toAssigneeId
      ? `Assigned to ${actorName(a.toAssigneeId)}`
      : rerouted
        ? `Routed ${teamName(a.fromTeamId)} → ${teamName(a.toTeamId)}`
        : 'Unassigned';

    return {
      id: a.id,
      timestamp: a.timestamp,
      actorId: a.actor,
      actorName: actorName(a.actor),
      category: 'assignment' as const,
      action,
      ticketId: a.ticketId,
      ticketRef: ticketRef(store, a.ticketId),
    };
  });
}

function escalationEntries(store: Store): AuditEntry[] {
  return store.escalations.map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    actorId: e.actor,
    actorName: actorName(e.actor),
    category: 'escalation' as const,
    action:
      e.direction === 'escalate'
        ? `Escalated ${e.fromTier} → ${e.toTier}${
            e.reason ? ` (${ESCALATION_REASON_LABELS[e.reason as EscalationReason] ?? e.reason})` : ''
          }`
        : `Returned to ${e.toTier}`,
    ticketId: e.ticketId,
    ticketRef: ticketRef(store, e.ticketId),
  }));
}

function noteEntries(store: Store): AuditEntry[] {
  // The note body is deliberately absent — the audit trail records that a note
  // was added, not what it said (product rule #5).
  return store.internalNotes.map((n) => ({
    id: n.id,
    timestamp: n.createdAt,
    actorId: n.agentId,
    actorName: n.agentName,
    category: 'note' as const,
    action: 'Internal note added',
    ticketId: n.ticketId,
    ticketRef: ticketRef(store, n.ticketId),
  }));
}

/** The ticket-derived trail, newest first, filtered. */
export async function listTicketAuditEntries(storeId: string, params: ListAuditParams = {}): Promise<AuditEntry[]> {
  await simulateLatency();
  const store = getStore(storeId);
  const { category, actorId, search } = params;

  let entries = [...statusEntries(store), ...assignmentEntries(store), ...escalationEntries(store), ...noteEntries(store)];

  if (category) entries = entries.filter((e) => e.category === category);
  if (actorId) entries = entries.filter((e) => e.actorId === actorId);
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    entries = entries.filter((e) => `${e.ticketRef ?? ''} ${e.actorName} ${e.action}`.toLowerCase().includes(q));
  }

  return clone(entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
}

/** Everyone who appears in the ticket-derived trail. */
export async function listTicketAuditActors(storeId: string): Promise<AuditActor[]> {
  await simulateLatency();
  const store = getStore(storeId);
  const entries = [...statusEntries(store), ...assignmentEntries(store), ...escalationEntries(store), ...noteEntries(store)];

  const seen = new Map<string, string>();
  for (const e of entries) seen.set(e.actorId, e.actorName);

  return [...seen.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
}
