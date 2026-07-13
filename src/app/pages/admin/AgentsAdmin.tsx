import { useCallback, useState } from 'react';
import { listAgentsAdmin, setAgentActive, setAgentTier } from '../../services/adminService';
import { listTeams } from '../../services/catalogService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import type { SupportTier } from '../../models/ticket';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Select } from '../../components/ui/Select';
import { LoadingGrid } from '../../components/help/HelpStates';

export function AgentsAdmin() {
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  const agents = useQuery(useCallback(() => listAgentsAdmin(), []), [version]);
  const teams = useQuery(useCallback(() => listTeams(), []), []);
  const active = useMutation(setAgentActive);
  const tier = useMutation(setAgentTier);
  const teamName = (id?: string) => teams.data?.find((t) => t.id === id)?.name ?? '—';

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Agents" subtitle="Roles, tiers, and activation (simulated)." />
      {agents.loading ? (
        <LoadingGrid count={2} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Agent</th>
                <th className="px-3 py-2 font-medium">Team</th>
                <th className="px-3 py-2 font-medium">Tier</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {agents.data?.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{a.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{teamName(a.teamId)}</td>
                  <td className="px-3 py-2">
                    <div className="w-24">
                      <Select
                        aria-label={`Tier for ${a.name}`}
                        value={a.tier ?? ''}
                        onChange={async (e) => { await tier.mutate(a.id, e.target.value as SupportTier); refresh(); }}
                      >
                        <option value="" disabled>—</option>
                        <option value="L1">L1</option>
                        <option value="L2">L2</option>
                      </Select>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={a.active ? 'success' : 'default'}>{a.active ? 'Active' : 'Inactive'}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="outline" onClick={async () => { await active.mutate(a.id, !a.active); refresh(); }}>
                      {a.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
