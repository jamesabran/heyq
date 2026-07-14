/**
 * reportsService — operational counters + simple chart data computed from the
 * mock ticket dataset at view time. Not an analytics platform.
 *
 * Future API endpoint:
 *   GET /reports/summary?team=  → getSummary
 */
import { tickets } from '../data/tickets';
import { teams, ticketCategories } from '../data/catalog';
import { STATUS_LABELS, type TicketStatus } from '../models/ticket';
import { computeSlaSummary } from './slaService';
import { worstSlaState } from '../components/ticket/badges';
import { clone, simulateLatency } from '../lib/mock';

export interface CountBucket {
  key: string;
  label: string;
  count: number;
}

export interface ReportSummary {
  total: number;
  open: number; // not resolved/closed
  unassigned: number;
  escalated: number;
  /** Reopened is a flag on the ticket, not a status — count the stamp. */
  reopened: number;
  slaBreached: number;
  slaAtRisk: number;
  byStatus: CountBucket[];
  byCategory: CountBucket[];
  byTeam: CountBucket[];
}

/** "Open" = not resolved/closed. Shared so overviewService can't drift from it. */
export const OPEN_STATUSES: TicketStatus[] = ['new', 'open', 'in_progress', 'on_hold'];

export async function getSummary(teamId?: string): Promise<ReportSummary> {
  await simulateLatency();
  const scope = tickets.filter((t) => !teamId || t.teamId === teamId);

  const byStatusMap = new Map<TicketStatus, number>();
  const byCategoryMap = new Map<string, number>();
  const byTeamMap = new Map<string, number>();
  let slaBreached = 0;
  let slaAtRisk = 0;

  for (const t of scope) {
    byStatusMap.set(t.status, (byStatusMap.get(t.status) ?? 0) + 1);
    byCategoryMap.set(t.categoryId, (byCategoryMap.get(t.categoryId) ?? 0) + 1);
    byTeamMap.set(t.teamId, (byTeamMap.get(t.teamId) ?? 0) + 1);
    const worst = worstSlaState(computeSlaSummary(t));
    if (worst === 'breached') slaBreached += 1;
    else if (worst === 'at_risk') slaAtRisk += 1;
  }

  const byStatus: CountBucket[] = (Object.keys(STATUS_LABELS) as TicketStatus[])
    .map((s) => ({ key: s, label: STATUS_LABELS[s], count: byStatusMap.get(s) ?? 0 }))
    .filter((b) => b.count > 0);

  const byCategory: CountBucket[] = [...byCategoryMap.entries()]
    .map(([id, count]) => ({ key: id, label: ticketCategories.find((c) => c.id === id)?.name ?? id, count }))
    .sort((a, b) => b.count - a.count);

  const byTeam: CountBucket[] = [...byTeamMap.entries()]
    .map(([id, count]) => ({ key: id, label: teams.find((t) => t.id === id)?.name ?? id, count }))
    .sort((a, b) => b.count - a.count);

  return clone({
    total: scope.length,
    open: scope.filter((t) => OPEN_STATUSES.includes(t.status)).length,
    unassigned: scope.filter((t) => !t.assigneeId).length,
    escalated: scope.filter((t) => t.escalationState !== 'none').length,
    reopened: scope.filter((t) => Boolean(t.reopenedAt)).length,
    slaBreached,
    slaAtRisk,
    byStatus,
    byCategory,
    byTeam,
  });
}
