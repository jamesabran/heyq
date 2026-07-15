/**
 * auditService — the org-wide activity trail (M20), now split across two
 * sources: ticket-derived entries (status/assignment/escalation/note history)
 * come from the HeyQ mock API server (server/audit.ts), since HeyQ owns ticket
 * state; KB entries stay local — KB isn't ticket state and wasn't moved.
 *
 * It records **what was done, by whom, and when** — never the content of an
 * internal note (product rule #5). Gated to team leads and admins (`AUDIT_ROLES`).
 *
 * Endpoints:
 *   GET /audit/tickets         → server-side ticket/assignment/escalation/note entries
 *   GET /audit/tickets/actors  → server-side ticket-derived actors
 */
import { kbArticles, kbRevisions } from '../data/kb';
import { agents } from '../data/catalog';
import { ROLE_LABELS, type Role } from '../lib/roles';
import { apiGet } from '../lib/apiClient';

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
  ticketId?: string;
  ticketRef?: string;
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

/** Same actor-name fallback as the server's copy, for the KB entries computed here. */
function actorName(id: string): string {
  if (id === 'system') return 'System';
  if (id === 'requester') return 'Requester';
  const agent = agents.find((a) => a.id === id);
  if (agent) return agent.name;
  return id in ROLE_LABELS ? ROLE_LABELS[id as Role] : id;
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
  const { category, actorId, search } = params;

  const [ticketEntries] = await Promise.all([apiGet<AuditEntry[]>('/audit/tickets')]);
  let entries: AuditEntry[] = [...ticketEntries, ...kbEntries()];

  if (category) entries = entries.filter((e) => e.category === category);
  if (actorId) entries = entries.filter((e) => e.actorId === actorId);
  if (search?.trim()) {
    const q = search.trim().toLowerCase();
    entries = entries.filter((e) =>
      `${e.ticketRef ?? ''} ${e.articleTitle ?? ''} ${e.actorName} ${e.action}`.toLowerCase().includes(q),
    );
  }

  return entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

/** Everyone who appears in the trail — drives the actor filter. */
export async function listAuditActors(): Promise<AuditActor[]> {
  const ticketEntries = await apiGet<AuditEntry[]>('/audit/tickets');
  const entries = [...ticketEntries, ...kbEntries()];

  const seen = new Map<string, string>();
  for (const e of entries) seen.set(e.actorId, e.actorName);

  return [...seen.entries()]
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
