import { useCallback, useState } from 'react';
import { setCategoryTeam } from '../../services/adminService';
import { listCategories, listTeams } from '../../services/catalogService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { PageHeader } from '../../components/layout/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Select } from '../../components/ui/Select';
import { LoadingGrid } from '../../components/help/HelpStates';

/** Routing rules: which team each concern category routes to on submission. */
export function RoutingAdmin() {
  const [version, setVersion] = useState(0);
  const categories = useQuery(useCallback(() => listCategories(), []), [version]);
  const teams = useQuery(useCallback(() => listTeams(), []), []);
  const route = useMutation(setCategoryTeam);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Routing Rules" subtitle="Concern → team routing applied when a ticket is submitted." />
      <Alert variant="info">
        Changes take effect immediately for new tickets — the submission form routes by these rules.
      </Alert>

      {categories.loading ? (
        <LoadingGrid count={2} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[520px] text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Concern category</th>
                <th className="px-3 py-2 font-medium">Routes to team</th>
              </tr>
            </thead>
            <tbody>
              {categories.data?.map((c) => (
                <tr key={c.id} className="border-b border-border last:border-0">
                  <td className="px-3 py-2 font-medium text-foreground">{c.name}</td>
                  <td className="px-3 py-2">
                    <div className="w-56">
                      <Select
                        aria-label={`Route ${c.name} to`}
                        value={c.defaultTeamId}
                        onChange={async (e) => { await route.mutate(c.id, e.target.value); setVersion((v) => v + 1); }}
                      >
                        {teams.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </Select>
                    </div>
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
