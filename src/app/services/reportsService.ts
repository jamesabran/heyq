/**
 * reportsService — thin HTTP client over server/reports.ts.
 *
 * Endpoint:
 *   GET /reports/summary?team=  → getSummary
 */
import type { TicketStatus } from '../models/ticket';
import { apiGet, buildQuery } from '../lib/apiClient';

export interface CountBucket {
  key: string;
  label: string;
  count: number;
}

export interface ReportSummary {
  total: number;
  open: number;
  unassigned: number;
  escalated: number;
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
  return apiGet<ReportSummary>(`/reports/summary${buildQuery({ team: teamId })}`);
}
