import { useCallback, useState } from 'react';
import { addCategory, addSubcategory } from '../../services/adminService';
import { listCategories, listTeams } from '../../services/catalogService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { LoadingGrid } from '../../components/help/HelpStates';

/** Concern taxonomy management: add categories and subcategories. */
export function CategoriesAdmin() {
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  const categories = useQuery(useCallback(() => listCategories(), []), [version]);
  const teams = useQuery(useCallback(() => listTeams(), []), []);
  const createCat = useMutation(addCategory);
  const createSub = useMutation(addSubcategory);

  const [name, setName] = useState('');
  const [team, setTeam] = useState('');
  const [subInputs, setSubInputs] = useState<Record<string, string>>({});

  async function onAddCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !team) return;
    await createCat.mutate(name, team);
    setName('');
    refresh();
  }

  async function onAddSub(categoryId: string) {
    const value = subInputs[categoryId]?.trim();
    if (!value) return;
    await createSub.mutate(categoryId, value);
    setSubInputs((s) => ({ ...s, [categoryId]: '' }));
    refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Categories" subtitle="Concern taxonomy used by the submission form and routing." />

      <Card>
        <CardHeader><CardTitle>Add a category</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={onAddCategory} className="flex flex-wrap items-end gap-2">
            <Input aria-label="Category name" placeholder="Category name…" value={name} onChange={(e) => setName(e.target.value)} className="max-w-xs" />
            <div className="w-48">
              <Select aria-label="Default team" value={team} onChange={(e) => setTeam(e.target.value)}>
                <option value="">Default team…</option>
                {teams.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
            </div>
            <Button type="submit" disabled={createCat.loading || !name.trim() || !team}>Add</Button>
          </form>
        </CardContent>
      </Card>

      {categories.loading ? (
        <LoadingGrid count={2} />
      ) : (
        <div className="flex flex-col gap-3">
          {categories.data?.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-semibold text-foreground">{c.name}</h3>
                  <span className="text-xs text-muted-foreground">{teams.data?.find((t) => t.id === c.defaultTeamId)?.name}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {c.subcategories.map((s) => <Badge key={s.id} variant="outline">{s.name}</Badge>)}
                  {c.subcategories.length === 0 && <span className="text-xs text-muted-foreground">No subcategories</span>}
                </div>
                <div className="flex gap-2">
                  <Input
                    aria-label={`Add subcategory to ${c.name}`}
                    placeholder="New subcategory…"
                    value={subInputs[c.id] ?? ''}
                    onChange={(e) => setSubInputs((s) => ({ ...s, [c.id]: e.target.value }))}
                    className="max-w-xs"
                  />
                  <Button size="sm" variant="outline" disabled={createSub.loading} onClick={() => onAddSub(c.id)}>Add subcategory</Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
