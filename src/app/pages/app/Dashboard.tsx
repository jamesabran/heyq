import { useCallback } from 'react';
import { getSummary } from '../../services/reportsService';
import { useQuery } from '../../hooks/useQuery';
import { useIdentity } from '../../contexts/IdentityContext';
import { PageHeader } from '../../components/layout/PageHeader';
import { BarList, StatTile } from '../../components/reports/charts';
import { LoadingGrid } from '../../components/help/HelpStates';

/** Operational dashboard. `scope='team'` limits to the viewer's team (supervisor). */
export function Dashboard({ scope = 'all' }: { scope?: 'all' | 'team' }) {
  const { identity } = useIdentity();
  const teamId = scope === 'team' ? identity.teamId : undefined;
  const summary = useQuery(useCallback(() => getSummary(teamId), [teamId]), [teamId]);

  const title = scope === 'team' ? 'Team Dashboard' : 'Reports';
  const subtitle = scope === 'team'
    ? `Operational snapshot for ${identity.teamName ?? 'your team'}.`
    : 'Operational snapshot across all tickets.';

  if (summary.loading || !summary.data) return <LoadingGrid count={3} />;
  const s = summary.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={title} subtitle={subtitle} />

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total" value={s.total} />
        <StatTile label="Open" value={s.open} />
        <StatTile label="Unassigned" value={s.unassigned} />
        <StatTile label="Escalated" value={s.escalated} tone="warning" />
        <StatTile label="SLA at risk" value={s.slaAtRisk} tone="warning" />
        <StatTile label="SLA breached" value={s.slaBreached} tone="danger" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <BarList title="Tickets by status" buckets={s.byStatus} />
        <BarList title="Tickets by category" buckets={s.byCategory} />
        <BarList title="Tickets by team" buckets={s.byTeam} />
      </div>
    </div>
  );
}
