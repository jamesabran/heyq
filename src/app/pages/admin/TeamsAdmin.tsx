import { useCallback, useState } from 'react';
import { addTeam } from '../../services/adminService';
import { listAgentsAdmin } from '../../services/adminService';
import { listTeams } from '../../services/catalogService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { PageHeader } from '../../components/layout/PageHeader';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { LoadingGrid } from '../../components/help/HelpStates';

export function TeamsAdmin() {
  const [version, setVersion] = useState(0);
  const [name, setName] = useState('');
  const teams = useQuery(useCallback(() => listTeams(), []), [version]);
  const agents = useQuery(useCallback(() => listAgentsAdmin(), []), [version]);
  const create = useMutation(addTeam);

  const memberCount = (teamId: string) => agents.data?.filter((a) => a.teamId === teamId).length ?? 0;

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await create.mutate(name);
    setName('');
    setVersion((v) => v + 1);
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Teams & Queues" subtitle="Support teams that own ticket queues." />

      <form onSubmit={onAdd} className="flex gap-2">
        <Input aria-label="New team name" placeholder="New team name…" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
        <Button type="submit" disabled={create.loading || !name.trim()}>Add team</Button>
      </form>

      {teams.loading ? (
        <LoadingGrid count={2} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {teams.data?.map((t) => (
            <Card key={t.id}>
              <CardContent className="p-5">
                <h3 className="font-semibold text-foreground">{t.name}</h3>
                <p className="text-sm text-muted-foreground">{memberCount(t.id)} agent(s)</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
