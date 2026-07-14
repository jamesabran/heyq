/**
 * auditService — the org-wide activity trail (M20).
 *
 * Another AGGREGATOR: it unifies the histories the app already records — status
 * events, assignments, escalations, internal notes, and KB revisions — into one
 * chronological stream. No new data model; nothing here is written by this
 * service, only read.
 *
 * It records **what was done, by whom, and when** — never the content of an
 * internal note (product rule #5 keeps note bodies on the ticket, where the
 * access rules around them already live). The audit viewer is gated to team
 * leads and admins (`AUDIT_ROLES`).
 *
 * Future API endpoint:
 *   GET /audit?category=&actor=&q=   → listAuditEntries
 */
import { assignments, escalations, internalNotes, statusEvents, tickets } from '../data/tickets';
import { kbArticles, kbRevisions } from '../data/kb';
import { agents, teams } from '../data/catalog';
import { ROLE_LABELS, type Role } from '../lib/roles';
import {
  ESCALATION_REASON_LABELS,
  STATUS_LABELS,
  type EscalationReason,
} from '../models/ticket';
import { clone, simulateLatency } from '../lib/mock';

export type AuditCategory = 'ticket' | 'assignment' | 'escalation' | 'note' | 'kb';

export const AUDIT_CATEGORY_LABELS: Record<AuditCategory, string> = {
  ticket: 'Ticket',
  assignment: 'Assignment',
  escalation: 'Escalation',
  note: 'Internal note',
  kb: 'Knowledge base',
};

export interface AuditEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  category: AuditCategory;
  /** What happened — the action, not the payload. */
  action: string;
  /** The ticket this entry belongs to, if any. */
  ticketId?: string;
  ticketRef?: string;
  /** The KB article this entry belongs to, if any. */
  articleId?: string;
  articleTitle?: string;
}

export interface ListAuditParams {
  category?: AuditCategory;
  actorId?: string;
  /** Matches the ticket reference, article title, actor, or action text. */
  search?: string;
}

export interface AuditActor {
  id: string;
  name: string;
}

const ticketRef = (id: string) => tickets.find((t) => t.id === id)?.reference;
const teamName = (id?: string) => teams.find((t) => t.id === id)?.name ?? id;

/**
 * Resolve an actor id to a display name. Most actors are support agents, but the
 * trail also carries the two non-human actors the seed uses (system, requester)
 * and the KB editor — who edits articles but is not an agent, so she is not in
 * the agent roster. Fall back to the role label rather than leaking a raw id.
 */
function actorName(id: string): string {
  if (id === 'system') return 'System';
  if (id === 'requester') return 'Requester';
  const agent = agents.find((a) => a.id === id);
  if (agent) return agent.name;
  return id in ROLE_LABELS ? ROLE_LABELS[id as Role] : id;
}

function statusEntries(): AuditEntry[] {
  return statusEvents.map((e) => ({
    id: e.id,
    timestamp: e.timestamp,
    actorId: e.actor,
    actorName: actorName(e.actor),
    category: 'ticket' as const,
    action: e.fromStatus
      ? `Status changed ${STATUS_LABELS[e.fromStatus]} → ${STATUS_LABELS[e.toStatus]}`
      : `Ticket created (${STATUS_LABELS[e.toStatus]})`,
    ticketId: e.ticketId,
    ticketRef: ticketRef(e.ticketId),
  }));
}

function assignmentEntries(): AuditEntry[] {
  return assignments.map((a) => {
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
      ticketRef: ticketRef(a.ticketId),
    };
  });
}

function escalationEntries(): AuditEntry[] {
  return escalations.map((e) => ({
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
    ticketRef: ticketRef(e.ticketId),
  }));
}

function noteEntries(): AuditEntry[] {
  // The note body is deliberately absent — the audit trail records that a note
  // was added, not what it said (product rule #5).
  return internalNotes.map((n) => ({
    id: n.id,
    timestamp: n.createdAt,
    actorId: n.agentId,
    actorName: n.agentName,
    category: 'note' as const,
    action: 'Internal note added',
    ticketId: n.ticketId,
    ticketRef: ticketRef(n.ticketId),
  }));
}

function kbEntries(): AuditEntry[] {
  return kbRevisions.map((r) => ({
    id: r.id,
    timestamp: r.createdAt,
    actorId: r.editorId,
    actorName: actorName(r.editorId),
    category: 'kb' as const,
    action: 'Article revised',
    articleId: r.articleId,
    articleTitle: kbArticles.find((a) => a.id === r.articleId)?.title ?? r.title,
  }));
}

/** The whole trail, newest first, filtered. */
export async function listAuditEntries(params: ListAuditParams = {}): Promise<AuditEntry[]> {
  await simulateLatency();
  const { category, actorId, search } = params;

  let entries = [
    ...statusEntries(),
    ...assignmentEntries(),
    ...escalationEntries(),
    ...noteEntries(),
    ...kbEntries(),
  ];

  if (category) entries = entries.filter((e) => e.category === category);
  if (actorId) entries = entries.filter((e) => e.actorId === actorId);
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    entries = entries.filter((e) =>
      `${e.ticketRef ?? ''} ${e.articleTitle ?? ''} ${e.actorName} ${e.action}`
        .toLowerCase()
        .includes(q),
    );
  }

  return clone(entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
}

/** Everyone who appears in the trail — drives the actor filter. */
export async function listAuditActors(): Promise<AuditActor[]> {
  await simulateLatency();
  const entries = [
    ...statusEntries(),
    ...assignmentEntries(),
    ...escalationEntries(),
    ...noteEntries(),
    ...kbEntries(),
  ];

  const seen = new Map<string, string>();
  for (const e of entries) seen.set(e.actorId, e.actorName);

  return [...seen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
