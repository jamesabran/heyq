import { useCallback, useEffect, useState } from 'react';
import { getSlaConfig, updateSlaConfig } from '../../services/adminService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { PageHeader } from '../../components/layout/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { Input } from '../../components/ui/Input';
import { LoadingGrid } from '../../components/help/HelpStates';

/** SLA policy config — placeholder targets + a business-hours label. */
export function SlaAdmin() {
  const config = useQuery(useCallback(() => getSlaConfig(), []), []);
  const save = useMutation(updateSlaConfig);
  const [firstResponseHours, setFr] = useState(4);
  const [resolutionHours, setRes] = useState(48);
  const [businessHours, setBh] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (config.data) {
      setFr(config.data.firstResponseHours);
      setRes(config.data.resolutionHours);
      setBh(config.data.businessHours);
    }
  }, [config.data]);

  if (config.loading) return <LoadingGrid count={1} />;

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    await save.mutate({ firstResponseHours, resolutionHours, businessHours });
    setSaved(true);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader title="SLA Policies" subtitle="Targets that drive SLA badges (single simulated policy)." />
      {saved && <Alert variant="success">SLA config saved. New badges reflect these targets.</Alert>}
      <Card>
        <CardContent className="pt-6">
          <form onSubmit={onSave} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="First-response target (hours)">
                {(id) => <Input id={id} type="number" min={1} value={firstResponseHours} onChange={(e) => { setFr(Number(e.target.value)); setSaved(false); }} />}
              </FormField>
              <FormField label="Resolution target (hours)">
                {(id) => <Input id={id} type="number" min={1} value={resolutionHours} onChange={(e) => { setRes(Number(e.target.value)); setSaved(false); }} />}
              </FormField>
            </div>
            <FormField label="Business hours" hint="Label only — no real calendar in the mock.">
              {(id) => <Input id={id} value={businessHours} onChange={(e) => { setBh(e.target.value); setSaved(false); }} />}
            </FormField>
            <div className="flex justify-end">
              <Button type="submit" disabled={save.loading}>Save SLA config</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
