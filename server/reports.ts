/**
 * reports — server-side port of src/app/services/reportsService.ts.
 *
 * Operational counters + simple chart data computed from the ticket store at
 * view time. Not an analytics platform.
 *
 * HTTP surface:
 *   GET /reports/summary?team=  → getSummary
 */
import { teams, ticketCategories } from '../src/app/data/catalog.ts';
import { STATUS_LABELS, type SlaState, type SlaSummary, type TicketStatus } from '../src/app/models/ticket.ts';
import { computeSlaSummary } from '../src/app/services/slaService.ts';
import { clone, simulateLatency } from '../src/app/lib/mock.ts';
import { getStore } from './store.ts';

// worstSlaState is duplicated (not imported) from
// src/app/components/ticket/badges.tsx: that file is JSX/React, which the
// server does not load. Keep this in sync if the severity order ever changes.
const SEVERITY_ORDER: SlaState[] = ['breached', 'at_risk', 'paused', 'on_track', 'met'];
function worstSlaState(sla: SlaSummary): SlaState {
  return [sla.firstResponse.state, sla.resolution.state].sort(
    (a, b) => SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b),
  )[0];
}

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

export async function getSummary(storeId: string, teamId?: string): Promise<ReportSummary> {
  await simulateLatency();
  const store = getStore(storeId);
  const scope = store.tickets.filter((t) => !teamId || t.teamId === teamId);

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
