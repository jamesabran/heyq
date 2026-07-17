import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router';
import { listAgents, listCategories, listTeams } from '../../services/catalogService';
import { createInternalTicket } from '../../services/ticketService';
import { lookupByTracking } from '../../services/transactionService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { useIdentity } from '../../contexts/IdentityContext';
import {
  CONCERN_TYPES,
  CONCERN_TYPE_LABELS,
  type ConcernType,
  type TicketPriority,
} from '../../models/ticket';
import { PageHeader } from '../../components/layout/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { AttachmentPicker } from '../../components/ticket/AttachmentPicker';

const PRIORITIES: TicketPriority[] = ['normal', 'high', 'urgent'];

/**
 * Internal ticket creation (M16). An agent logs a concern that didn't arrive via
 * the requester form (phone, walk-in, internal report, monitoring incident, …).
 * Same native ticket model — source `internal`, requester notifications OFF by
 * default unless an external customer is attached and the agent opts in.
 */
export function NewTicket() {
  const { identity } = useIdentity();
  const navigate = useNavigate();

  const categories = useQuery(useCallback(() => listCategories(), []), []);
  const teams = useQuery(useCallback(() => listTeams(), []), []);
  const agents = useQuery(useCallback(() => listAgents(), []), []);
  const create = useMutation(createInternalTicket);

  const [hasExternal, setHasExternal] = useState(false);
  const [notify, setNotify] = useState(false);
  const [form, setForm] = useState({
    requesterName: '', requesterEmail: '', requesterMobile: '',
    categoryId: '', subcategoryId: '', concernType: '' as ConcernType | '',
    subject: '', description: '', priority: 'normal' as TicketPriority,
    teamId: '', assigneeId: '', trackingNumber: '', internalNote: '',
  });
  const [attachments, setAttachments] = useState<File[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const selectedCategory = categories.data?.find((c) => c.id === form.categoryId);

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!form.categoryId) next.categoryId = 'Choose a category.';
    if (!form.subject.trim()) next.subject = 'A subject is required.';
    if (!form.description.trim()) next.description = 'Describe the concern.';
    if (hasExternal && !form.requesterName.trim()) next.requesterName = 'Requester name is required.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    // Optional tracking number → link the transaction when it resolves uniquely.
    let relatedTransactionId: string | undefined;
    if (form.trackingNumber.trim()) {
      const res = await lookupByTracking(form.trackingNumber);
      if (res.status === 'found') relatedTransactionId = res.transaction.id;
    }

    const result = await create.mutate({
      reporterId: identity.id,
      requesterName: hasExternal ? form.requesterName : undefined,
      requesterEmail: hasExternal ? form.requesterEmail || undefined : undefined,
      requesterMobile: hasExternal ? form.requesterMobile || undefined : undefined,
      requesterNotificationsEnabled: hasExternal ? notify : false,
      categoryId: form.categoryId,
      subcategoryId: form.subcategoryId || undefined,
      concernType: form.concernType || undefined,
      subject: form.subject,
      description: form.description,
      priority: form.priority,
      teamId: form.teamId || undefined,
      assigneeId: form.assigneeId || undefined,
      relatedTransactionId,
      internalNote: form.internalNote || undefined,
      // This agent form records attachment metadata only (no upload here); the
      // real upload path is the ticket conversation composer.
      attachments: attachments.map((f) => ({ name: f.name, size: f.size, type: f.type })),
    });
    navigate(`/app/tickets/${result.ticket.id}`);
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <Breadcrumb items={[{ label: 'My Queue', to: '/app/mine' }, { label: 'New ticket' }]} />
      <PageHeader title="New internal ticket" subtitle="Log a concern reported by phone, walk-in, another team, or monitoring." />

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Card>
          <CardHeader><CardTitle>Source & reporter</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Source</span>
              <span className="rounded-full border border-border px-2.5 py-0.5 text-xs font-medium">Internal</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Reporter</span>
              <span className="font-medium text-foreground">{identity.name}</span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={hasExternal} onChange={(e) => setHasExternal(e.target.checked)} />
              This concern is from an external customer
            </label>
            {hasExternal && (
              <div className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-2">
                <FormField label="Requester name" error={errors.requesterName}>
                  {(id) => <Input id={id} value={form.requesterName} onChange={(e) => set('requesterName', e.target.value)} />}
                </FormField>
                <FormField label="Requester email">
                  {(id) => <Input id={id} type="email" value={form.requesterEmail} onChange={(e) => set('requesterEmail', e.target.value)} />}
                </FormField>
                <FormField label="Requester mobile">
                  {(id) => <Input id={id} value={form.requesterMobile} onChange={(e) => set('requesterMobile', e.target.value)} />}
                </FormField>
                <label className="flex items-center gap-2 self-end pb-2 text-sm sm:col-span-2">
                  <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
                  Enable requester notifications for this ticket
                </label>
              </div>
            )}
            {!hasExternal && (
              <Alert variant="info">
                Requester notifications are off for internal tickets. Add an external customer above to enable them.
              </Alert>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Concern</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Category" error={errors.categoryId}>
              {(id) => (
                <Select id={id} value={form.categoryId} onChange={(e) => { set('categoryId', e.target.value); set('subcategoryId', ''); }}>
                  <option value="">Select a category…</option>
                  {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}
            </FormField>
            {selectedCategory && selectedCategory.subcategories.length > 0 && (
              <FormField label="Subcategory (optional)">
                {(id) => (
                  <Select id={id} value={form.subcategoryId} onChange={(e) => set('subcategoryId', e.target.value)}>
                    <option value="">Select a subcategory…</option>
                    {selectedCategory.subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </Select>
                )}
              </FormField>
            )}
            <FormField label="Concern type">
              {(id) => (
                <Select id={id} value={form.concernType} onChange={(e) => set('concernType', e.target.value as ConcernType | '')}>
                  <option value="">Auto from category</option>
                  {CONCERN_TYPES.map((c) => <option key={c} value={c}>{CONCERN_TYPE_LABELS[c]}</option>)}
                </Select>
              )}
            </FormField>
            <FormField label="Priority">
              {(id) => (
                <Select id={id} value={form.priority} onChange={(e) => set('priority', e.target.value as TicketPriority)}>
                  {PRIORITIES.map((p) => <option key={p} value={p} className="capitalize">{p}</option>)}
                </Select>
              )}
            </FormField>
            <FormField label="Subject" error={errors.subject}>
              {(id) => <Input id={id} value={form.subject} onChange={(e) => set('subject', e.target.value)} placeholder="Brief summary" />}
            </FormField>
            <FormField label="Tracking number (optional)" hint="Links a GGX transaction if it resolves uniquely.">
              {(id) => <Input id={id} value={form.trackingNumber} onChange={(e) => set('trackingNumber', e.target.value)} placeholder="e.g. 1GGT-AYT1-TKK3" />}
            </FormField>
            <div className="sm:col-span-2">
              <FormField label="Description" error={errors.description}>
                {(id) => <Textarea id={id} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="What happened?" />}
              </FormField>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Assignment & notes</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Team (optional)" hint="Defaults to the category's team.">
                {(id) => (
                  <Select id={id} value={form.teamId} onChange={(e) => set('teamId', e.target.value)}>
                    <option value="">Route by category</option>
                    {teams.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </Select>
                )}
              </FormField>
              <FormField label="Assignee (optional)">
                {(id) => (
                  <Select id={id} value={form.assigneeId} onChange={(e) => set('assigneeId', e.target.value)}>
                    <option value="">Leave unassigned</option>
                    {agents.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </Select>
                )}
              </FormField>
            </div>
            <FormField label="Internal note (optional)" hint="Never shown to requesters.">
              {(id) => <Textarea id={id} value={form.internalNote} onChange={(e) => set('internalNote', e.target.value)} placeholder="Context for the team…" className="min-h-16" />}
            </FormField>
            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">Attachments (optional)</p>
              <AttachmentPicker value={attachments} onChange={setAttachments} />
            </div>
          </CardContent>
        </Card>

        {create.error && <Alert variant="destructive" title="Couldn't create the ticket">{create.error.message}</Alert>}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => navigate('/app')}>Cancel</Button>
          <Button type="submit" disabled={create.loading}>
            {create.loading ? 'Creating…' : 'Create ticket'}
          </Button>
        </div>
      </form>
    </div>
  );
}
