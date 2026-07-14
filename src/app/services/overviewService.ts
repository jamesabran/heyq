/**
 * overviewService — the role-aware Overview home (M19).
 *
 * A thin AGGREGATOR, not a new domain: every counter and row here is composed
 * from reportsService, ticketService, requesterService, transactionService, and
 * kbService reading the same seeds the queues read. No new data model, no new
 * state, no widget system — the shape simply branches by role.
 *
 * Future API endpoint:
 *   GET /overview   → getOverview (the server resolves the viewer from session)
 */
import type { Role } from '../lib/roles';
import type { KbArticle } from '../models/kb';
import type {
  PaymentStatus,
  ShipmentStatus,
  Ticket,
  TicketListItem,
  TicketPriority,
} from '../models/ticket';
import { listTickets } from './ticketService';
import { listTicketsForRequester, type RequesterTicketSummary } from './requesterService';
import { getSummary, OPEN_STATUSES, type CountBucket } from './reportsService';
import { getTransactionForTicket } from './transactionService';
import { listAllArticles } from './kbService';
import { isPubliclyReadable } from '../models/kb';
import { worstSlaState } from '../components/ticket/badges';
import { simulatedNowMs } from '../lib/clock';

/** The signed-in identity, reduced to what the aggregator actually scopes on. */
export interface OverviewViewer {
  id: string;
  role: Role;
  teamId?: string;
  requesterId?: string;
}

export interface OverviewCounter {
  key: string;
  label: string;
  value: number;
  tone?: 'default' | 'warning' | 'danger';
  /** Deep link to the filtered list this counter counts (rule: everything links). */
  to: string;
}

/**
 * A ticket needing attention, plus the GGX context needed to triage it (M13). The
 * tracking number itself now lives on `TicketListItem` (every table shows it), so
 * this carries only what the queues don't: the shipment/payment state and whether
 * the transaction data is stale.
 */
export interface AttentionRow {
  item: TicketListItem;
  transaction?: {
    shipmentStatus: ShipmentStatus;
    paymentStatus?: PaymentStatus;
    stale: boolean;
  };
}

export interface AttentionList {
  key: string;
  title: string;
  description: string;
  rows: AttentionRow[];
  /** The queue this list previews. */
  to: string;
}

export interface TicketOverview {
  kind: 'tickets';
  counters: OverviewCounter[];
  lists: AttentionList[];
  /** Only where a trend earns its place (supervisor/admin) — no decorative charts. */
  trend?: { title: string; buckets: CountBucket[] };
  /** Tickets exist in scope at all — separates "no work" from "nothing urgent". */
  hasWork: boolean;
  /** Some transaction context on the attention rows is past its freshness window. */
  hasStaleData: boolean;
}

export interface KbOverview {
  kind: 'kb';
  counters: OverviewCounter[];
  drafts: KbArticle[];
}

export interface RequesterOverview {
  kind: 'requester';
  counters: OverviewCounter[];
  awaitingReply: RequesterTicketSummary[];
  tickets: RequesterTicketSummary[];
}

export type OverviewData = TicketOverview | KbOverview | RequesterOverview;

/** Attention lists are previews — the full set is one click away in the queue. */
const PREVIEW_LIMIT = 5;
const HIGH_PRIORITIES: TicketPriority[] = ['urgent', 'high'];

const isOpen = (t: Ticket) => OPEN_STATUSES.includes(t.status);

function isResolvedToday(t: Ticket): boolean {
  if (!t.resolvedAt) return false;
  const now = new Date(simulatedNowMs());
  const at = new Date(t.resolvedAt);
  return (
    at.getUTCFullYear() === now.getUTCFullYear() &&
    at.getUTCMonth() === now.getUTCMonth() &&
    at.getUTCDate() === now.getUTCDate()
  );
}

const slaOf = (i: TicketListItem) => worstSlaState(i.sla);
const needsAttention = (i: TicketListItem) =>
  isOpen(i.ticket) &&
  (i.ticket.priority === 'urgent' ||
    Boolean(i.ticket.reopenedAt) ||
    slaOf(i) === 'breached' ||
    slaOf(i) === 'at_risk');

/** Worst first, so the row an agent should open is the row at the top. */
const RANK: Record<string, number> = { breached: 0, at_risk: 1, paused: 2, on_track: 3, met: 4 };
function byUrgency(a: TicketListItem, b: TicketListItem): number {
  const sla = RANK[slaOf(a)] - RANK[slaOf(b)];
  if (sla !== 0) return sla;
  const pri = (a.ticket.priority === 'urgent' ? 0 : 1) - (b.ticket.priority === 'urgent' ? 0 : 1);
  if (pri !== 0) return pri;
  return b.ticket.updatedAt.localeCompare(a.ticket.updatedAt);
}

/**
 * Resolve the GGX transaction context for the rows we're about to show. Only the
 * preview rows are resolved, and a failed/denied lookup degrades to no context —
 * the Overview must still render when the transaction source is unavailable.
 */
async function toRows(items: TicketListItem[], viewerTeamId?: string): Promise<AttentionRow[]> {
  return Promise.all(
    items.map(async (item) => {
      if (!item.ticket.relatedTransactionId) return { item };
      const result = await getTransactionForTicket(item.ticket.relatedTransactionId, viewerTeamId);
      if (result.status !== 'found') return { item };
      return {
        item,
        transaction: {
          shipmentStatus: result.transaction.shipmentStatus,
          paymentStatus: result.transaction.paymentStatus,
          stale: result.stale,
        },
      };
    }),
  );
}

async function buildList(
  key: string,
  title: string,
  description: string,
  to: string,
  items: TicketListItem[],
  viewerTeamId?: string,
): Promise<AttentionList> {
  const rows = await toRows(items.slice(0, PREVIEW_LIMIT), viewerTeamId);
  return { key, title, description, rows, to };
}

/** L1/L2 agent: my work first, then the pool I can pull from. */
async function agentOverview(viewer: OverviewViewer): Promise<TicketOverview> {
  const [mine, teamPool] = await Promise.all([
    listTickets({ queue: 'mine', viewerId: viewer.id, viewerTeamId: viewer.teamId }),
    listTickets({ queue: 'unassigned', viewerId: viewer.id, viewerTeamId: viewer.teamId }),
  ]);

  const myOpen = mine.filter((i) => isOpen(i.ticket));
  const attention = myOpen.filter(needsAttention).sort(byUrgency);
  const unassignedHigh = teamPool
    .filter((i) => HIGH_PRIORITIES.includes(i.ticket.priority))
    .sort(byUrgency);

  const counters: OverviewCounter[] = [
    { key: 'assigned', label: 'Assigned to me', value: myOpen.length, to: '/app/mine' },
    {
      key: 'urgent',
      label: 'Urgent',
      value: myOpen.filter((i) => i.ticket.priority === 'urgent').length,
      tone: 'danger',
      to: '/app/mine?priority=urgent',
    },
    {
      key: 'at_risk',
      label: 'SLA at risk',
      value: myOpen.filter((i) => slaOf(i) === 'at_risk').length,
      tone: 'warning',
      to: '/app/sla',
    },
    {
      key: 'breached',
      label: 'SLA breached',
      value: myOpen.filter((i) => slaOf(i) === 'breached').length,
      tone: 'danger',
      to: '/app/sla',
    },
    {
      key: 'reopened',
      label: 'Reopened',
      value: myOpen.filter((i) => Boolean(i.ticket.reopenedAt)).length,
      tone: 'warning',
      to: '/app/mine?reopened=1',
    },
    {
      key: 'resolved_today',
      label: 'Resolved today',
      value: mine.filter((i) => isResolvedToday(i.ticket)).length,
      to: '/app/mine?status=resolved',
    },
  ];

  const lists = await Promise.all([
    buildList(
      'attention',
      'Needs your attention',
      'Assigned to you and urgent, reopened, or against the SLA clock.',
      '/app/mine',
      attention,
      viewer.teamId,
    ),
    buildList(
      'unassigned',
      'Unassigned — high priority',
      "High and urgent tickets in your team's pool that nobody has claimed.",
      '/app/unassigned',
      unassignedHigh,
      viewer.teamId,
    ),
  ]);

  return {
    kind: 'tickets',
    counters,
    lists,
    hasWork: mine.length > 0 || teamPool.length > 0,
    hasStaleData: hasStale(lists),
  };
}

/** Supervisor / admin: the whole scope, not just their own assignments. */
async function scopeOverview(viewer: OverviewViewer, scope: 'team' | 'org'): Promise<TicketOverview> {
  // A team lead is scoped to their team; an admin has no teamId, so both the
  // summary and the queues widen to the whole org — the same rule the queues use.
  const teamId = scope === 'team' ? viewer.teamId : undefined;

  const [summary, all, unassigned, escalated] = await Promise.all([
    getSummary(teamId),
    listTickets({ queue: 'all', viewerId: viewer.id, viewerTeamId: teamId }),
    listTickets({ queue: 'unassigned', viewerId: viewer.id, viewerTeamId: teamId }),
    listTickets({ queue: 'escalated', viewerId: viewer.id, viewerTeamId: teamId }),
  ]);

  const open = all.filter((i) => isOpen(i.ticket));
  const slaRisk = open.filter((i) => slaOf(i) === 'breached' || slaOf(i) === 'at_risk').sort(byUrgency);
  const unassignedHigh = unassigned
    .filter((i) => HIGH_PRIORITIES.includes(i.ticket.priority))
    .sort(byUrgency);
  const reopened = open.filter((i) => Boolean(i.ticket.reopenedAt)).sort(byUrgency);

  const counters: OverviewCounter[] = [
    { key: 'open', label: 'Open', value: summary.open, to: '/app/team' },
    { key: 'unassigned', label: 'Unassigned', value: summary.unassigned, to: '/app/unassigned' },
    {
      key: 'urgent',
      label: 'Urgent',
      value: open.filter((i) => i.ticket.priority === 'urgent').length,
      tone: 'danger',
      to: '/app/team?priority=urgent',
    },
    { key: 'at_risk', label: 'SLA at risk', value: summary.slaAtRisk, tone: 'warning', to: '/app/sla' },
    { key: 'breached', label: 'SLA breached', value: summary.slaBreached, tone: 'danger', to: '/app/sla' },
    { key: 'escalated', label: 'Escalated', value: summary.escalated, tone: 'warning', to: '/app/escalated' },
    { key: 'reopened', label: 'Reopened', value: summary.reopened, tone: 'warning', to: '/app/team?reopened=1' },
    {
      key: 'resolved_today',
      label: 'Resolved today',
      value: all.filter((i) => isResolvedToday(i.ticket)).length,
      to: '/app/team?status=resolved',
    },
  ];

  const lists = await Promise.all([
    buildList('sla', 'SLA breached & at risk', 'Against the clock — oldest breach first.', '/app/sla', slaRisk, teamId),
    buildList(
      'unassigned',
      'Unassigned — high priority',
      'High and urgent tickets nobody has claimed yet.',
      '/app/unassigned',
      unassignedHigh,
      teamId,
    ),
    buildList(
      'escalated',
      'Escalations',
      'Escalation state — independent of workflow status.',
      '/app/escalated',
      escalated.sort(byUrgency),
      teamId,
    ),
    buildList('reopened', 'Reopened', 'Came back after being resolved.', '/app/team?reopened=1', reopened, teamId),
  ]);

  return {
    kind: 'tickets',
    counters,
    lists,
    // The one trend that earns its place: where the scope's workload sits today.
    trend: {
      title: scope === 'team' ? 'Team tickets by status' : 'Tickets by team',
      buckets: scope === 'team' ? summary.byStatus : summary.byTeam,
    },
    hasWork: all.length > 0,
    hasStaleData: hasStale(lists),
  };
}

/** KB editor: their publishing pipeline, not a ticket queue. */
async function kbOverview(): Promise<KbOverview> {
  const articles = await listAllArticles();
  const drafts = [...articles]
    .filter((a) => a.status === 'draft')
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const counters: OverviewCounter[] = [
    { key: 'published', label: 'Published', value: articles.filter(isPubliclyReadable).length, to: '/admin/kb' },
    { key: 'drafts', label: 'Drafts', value: drafts.length, tone: 'warning', to: '/admin/kb' },
    {
      key: 'internal',
      label: 'Internal only',
      value: articles.filter((a) => a.visibility === 'internal').length,
      to: '/admin/kb',
    },
    { key: 'total', label: 'All articles', value: articles.length, to: '/admin/kb' },
  ];

  return { kind: 'kb', counters, drafts: drafts.slice(0, PREVIEW_LIMIT) };
}

/** Requester: their own tickets only — never an agent surface (product rule #5). */
async function requesterOverview(requesterId: string): Promise<RequesterOverview> {
  const tickets = await listTicketsForRequester(requesterId);
  // "Awaiting your reply" is now on-hold *specifically* on the requester — a
  // ticket held on an internal team is not the customer's to unblock.
  const awaitingReply = tickets.filter(
    (t) => t.ticket.status === 'on_hold' && t.ticket.holdReason === 'waiting_requester',
  );

  const counters: OverviewCounter[] = [
    { key: 'open', label: 'Open tickets', value: tickets.filter((t) => isOpen(t.ticket)).length, to: '/app' },
    { key: 'awaiting', label: 'Awaiting your reply', value: awaitingReply.length, tone: 'warning', to: '/app' },
    {
      key: 'resolved',
      label: 'Resolved',
      value: tickets.filter((t) => t.ticket.status === 'resolved' || t.ticket.status === 'closed').length,
      to: '/app',
    },
  ];

  return { kind: 'requester', counters, awaitingReply, tickets };
}

function hasStale(lists: AttentionList[]): boolean {
  return lists.some((l) => l.rows.some((r) => r.transaction?.stale));
}

/** The Overview for whoever is signed in. Content branches by role, never by widget config. */
export async function getOverview(viewer: OverviewViewer): Promise<OverviewData> {
  switch (viewer.role) {
    case 'customer':
      // No seeded requester behind the identity → an empty (not broken) Overview.
      return requesterOverview(viewer.requesterId ?? '');
    case 'kb_editor':
      return kbOverview();
    case 'admin':
      return scopeOverview(viewer, 'org');
    case 'team_lead':
      return scopeOverview(viewer, 'team');
    default:
      return agentOverview(viewer);
  }
}
