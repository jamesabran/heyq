import { useCallback, useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { IconCircleCheck } from '@tabler/icons-react';
import { listCategories, getTransactionById } from '../services/catalogService';
import { createTicket, type CreateTicketResult } from '../services/ticketService';
import { useQuery } from '../hooks/useQuery';
import { useMutation } from '../hooks/useMutation';
import type { MockAttachment } from '../models/ticket';
import { PageHeader } from '../components/layout/PageHeader';
import { Alert } from '../components/ui/Alert';
import { Button, buttonVariants } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Textarea } from '../components/ui/Textarea';
import { AttachmentPicker } from '../components/ticket/AttachmentPicker';

interface FormState {
  name: string;
  email: string;
  mobile: string;
  categoryId: string;
  subcategoryId: string;
  subject: string;
  description: string;
  trackingNumber: string;
  orderRef: string;
  attachments: MockAttachment[];
}

const EMPTY: FormState = {
  name: '', email: '', mobile: '', categoryId: '', subcategoryId: '',
  subject: '', description: '', trackingNumber: '', orderRef: '', attachments: [],
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ContactPage() {
  const [params] = useSearchParams();
  const txId = params.get('tx') ?? '';

  const categories = useQuery(useCallback(() => listCategories(), []), []);
  const transaction = useQuery(
    useCallback(() => (txId ? getTransactionById(txId) : Promise.resolve(null)), [txId]),
    [txId],
  );
  const tx = transaction.data;
  const fromTransaction = Boolean(tx);

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [result, setResult] = useState<CreateTicketResult | null>(null);
  const submit = useMutation(createTicket);

  // Prefill known, read-only fields when arriving from a transaction.
  useEffect(() => {
    if (!tx) return;
    setForm((f) => ({
      ...f,
      name: tx.requesterName ?? f.name,
      email: tx.requesterEmail ?? f.email,
      mobile: tx.requesterMobile ?? f.mobile,
      trackingNumber: tx.trackingNumber ?? f.trackingNumber,
      orderRef: tx.orderId ?? f.orderRef,
    }));
  }, [tx]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const selectedCategory = categories.data?.find((c) => c.id === form.categoryId);

  function validate(): boolean {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = 'Your name is required.';
    if (!form.email.trim()) next.email = 'Your email is required.';
    else if (!EMAIL_RE.test(form.email.trim())) next.email = 'Enter a valid email address.';
    if (!form.categoryId) next.categoryId = 'Choose a concern type.';
    if (!form.subject.trim()) next.subject = 'A subject is required.';
    if (!form.description.trim()) next.description = 'Please describe your concern.';
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    const res = await submit.mutate({
      name: form.name,
      email: form.email,
      mobile: form.mobile || undefined,
      categoryId: form.categoryId,
      subcategoryId: form.subcategoryId || undefined,
      subject: form.subject,
      description: form.description,
      trackingNumber: form.trackingNumber || undefined,
      orderRef: form.orderRef || undefined,
      attachments: form.attachments,
      relatedTransactionId: tx?.id,
    });
    setResult(res);
  }

  if (result) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 px-6 py-10 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <IconCircleCheck size={28} />
            </span>
            <h1 className="text-2xl font-bold text-foreground">Ticket submitted</h1>
            <p className="text-muted-foreground">
              Your reference is{' '}
              <strong className="text-foreground">{result.reference}</strong>. We&apos;ve routed it to
              the right team.
            </p>
            <Alert variant="info" className="text-left">
              Track your ticket using the secure link below. Keep it private — the
              reference number alone does not open your ticket.
            </Alert>
            <div className="flex flex-wrap justify-center gap-3">
              <Link to={`/t/${result.accessToken}`} className={buttonVariants({ variant: 'default' })}>
                View your ticket
              </Link>
              <Button variant="outline" onClick={() => { setResult(null); setForm(EMPTY); }}>
                Submit another
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <PageHeader title="Submit a ticket" subtitle="Tell us what's going on and we'll help you out." />

      {fromTransaction && (
        <Alert variant="brand" title="Starting from a transaction">
          We&apos;ve prefilled known details from transaction <strong>{tx?.id}</strong>. These fields
          are read-only.
        </Alert>
      )}

      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <Card>
          <CardHeader><CardTitle>Your details</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <FormField label="Name" error={errors.name}>
              {(id) => (
                <Input id={id} value={form.name} readOnly={fromTransaction}
                  onChange={(e) => setField('name', e.target.value)} />
              )}
            </FormField>
            <FormField label="Email" error={errors.email}>
              {(id) => (
                <Input id={id} type="email" value={form.email} readOnly={fromTransaction}
                  onChange={(e) => setField('email', e.target.value)} />
              )}
            </FormField>
            <FormField label="Mobile (optional)">
              {(id) => (
                <Input id={id} value={form.mobile} readOnly={fromTransaction}
                  onChange={(e) => setField('mobile', e.target.value)} />
              )}
            </FormField>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Your concern</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Concern type" error={errors.categoryId}>
                {(id) => (
                  <Select id={id} value={form.categoryId} disabled={categories.loading}
                    onChange={(e) => { setField('categoryId', e.target.value); setField('subcategoryId', ''); }}>
                    <option value="">Select a concern…</option>
                    {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </Select>
                )}
              </FormField>
              {selectedCategory && selectedCategory.subcategories.length > 0 && (
                <FormField label="Subcategory (optional)">
                  {(id) => (
                    <Select id={id} value={form.subcategoryId}
                      onChange={(e) => setField('subcategoryId', e.target.value)}>
                      <option value="">Select a subcategory…</option>
                      {selectedCategory.subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </Select>
                  )}
                </FormField>
              )}
            </div>

            {(selectedCategory?.requiresTracking || fromTransaction) && (
              <FormField label="Tracking number" hint="Helps us locate your shipment.">
                {(id) => (
                  <Input id={id} value={form.trackingNumber} readOnly={fromTransaction}
                    onChange={(e) => setField('trackingNumber', e.target.value)} />
                )}
              </FormField>
            )}
            {(selectedCategory?.requiresOrderRef || (fromTransaction && form.orderRef)) && (
              <FormField label="Order / reference ID">
                {(id) => (
                  <Input id={id} value={form.orderRef} readOnly={fromTransaction}
                    onChange={(e) => setField('orderRef', e.target.value)} />
                )}
              </FormField>
            )}

            <FormField label="Subject" error={errors.subject}>
              {(id) => (
                <Input id={id} value={form.subject}
                  onChange={(e) => setField('subject', e.target.value)} placeholder="Brief summary" />
              )}
            </FormField>
            <FormField label="Description" error={errors.description}>
              {(id) => (
                <Textarea id={id} value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  placeholder="Describe what happened…" />
              )}
            </FormField>

            <div>
              <p className="mb-1.5 text-sm font-medium text-foreground">Attachments (optional)</p>
              <AttachmentPicker value={form.attachments} onChange={(a) => setField('attachments', a)} />
            </div>
          </CardContent>
        </Card>

        {submit.error && <Alert variant="destructive" title="Something went wrong">{submit.error.message}</Alert>}

        <div className="flex justify-end">
          <Button type="submit" disabled={submit.loading}>
            {submit.loading ? 'Submitting…' : 'Submit ticket'}
          </Button>
        </div>
      </form>
    </div>
  );
}
