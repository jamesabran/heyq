import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  createArticle,
  getArticleForEdit,
  listAllCategories,
  listRevisions,
  publishArticle,
  unpublishArticle,
  updateArticle,
} from '../../services/kbService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { useIdentity } from '../../contexts/IdentityContext';
import type { KbVisibility } from '../../models/kb';
import { formatDateTime } from '../../lib/utils';
import { PageHeader } from '../../components/layout/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { EmptyState, LoadingGrid } from '../../components/help/HelpStates';

interface FormState {
  title: string;
  kbCategoryId: string;
  excerpt: string;
  body: string;
  visibility: KbVisibility;
  order: number;
}

const BLANK: FormState = { title: '', kbCategoryId: '', excerpt: '', body: '', visibility: 'public', order: 1 };

export function KbArticleEditor() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { identity } = useIdentity();
  const navigate = useNavigate();
  const [version, setVersion] = useState(0);

  const categories = useQuery(useCallback(() => listAllCategories(), []), []);
  const existing = useQuery(
    useCallback(() => (id ? getArticleForEdit(id) : Promise.resolve(null)), [id]),
    [id, version],
  );
  const revisions = useQuery(
    useCallback(() => (id ? listRevisions(id) : Promise.resolve([])), [id]),
    [id, version],
  );

  const create = useMutation(createArticle);
  const update = useMutation(updateArticle);
  const publish = useMutation(publishArticle);
  const unpublish = useMutation(unpublishArticle);

  const [form, setForm] = useState<FormState>(BLANK);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const article = existing.data;

  useEffect(() => {
    if (article) {
      setForm({
        title: article.title, kbCategoryId: article.kbCategoryId, excerpt: article.excerpt,
        body: article.body, visibility: article.visibility, order: article.order,
      });
    } else if (!isEdit && categories.data && !form.kbCategoryId) {
      setForm((f) => ({ ...f, kbCategoryId: categories.data![0]?.id ?? '' }));
    }
  }, [article, isEdit, categories.data, form.kbCategoryId]);

  if (isEdit && existing.loading) return <LoadingGrid count={2} />;
  if (isEdit && !article) return <EmptyState title="Article not found">This article doesn&apos;t exist.</EmptyState>;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  async function onSave() {
    if (!form.title.trim() || !form.kbCategoryId) { setError('Title and category are required.'); return; }
    setError('');
    if (isEdit && id) {
      await update.mutate(id, identity.id, form);
      setVersion((v) => v + 1);
      setSaved(true);
    } else {
      const created = await create.mutate(
        { title: form.title, kbCategoryId: form.kbCategoryId, excerpt: form.excerpt, body: form.body, visibility: form.visibility, order: form.order },
        identity.id,
      );
      navigate(`/admin/kb/${created.id}`);
    }
  }

  const busy = create.loading || update.loading || publish.loading || unpublish.loading;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        title={isEdit ? 'Edit article' : 'New article'}
        subtitle={<Link to="/admin/kb" className="text-primary hover:underline">← Back to Knowledge Base</Link>}
        action={
          article ? (
            <div className="flex items-center gap-2">
              <Badge variant={article.status === 'published' ? 'success' : 'default'}>{article.status}</Badge>
              <Badge variant={article.visibility === 'internal' ? 'warning' : 'outline'}>{article.visibility}</Badge>
            </div>
          ) : undefined
        }
      />

      {saved && <Alert variant="success">Changes saved. A revision was recorded.</Alert>}
      {error && <Alert variant="destructive">{error}</Alert>}

      <Card>
        <CardContent className="flex flex-col gap-4 pt-6">
          <FormField label="Title">{(fid) => <Input id={fid} value={form.title} onChange={(e) => set('title', e.target.value)} />}</FormField>
          <div className="grid gap-4 sm:grid-cols-3">
            <FormField label="Category" className="sm:col-span-2">
              {(fid) => (
                <Select id={fid} value={form.kbCategoryId} onChange={(e) => set('kbCategoryId', e.target.value)}>
                  <option value="">Select…</option>
                  {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}
            </FormField>
            <FormField label="Visibility">
              {(fid) => (
                <Select id={fid} value={form.visibility} onChange={(e) => set('visibility', e.target.value as KbVisibility)}>
                  <option value="public">Public</option>
                  <option value="internal">Internal</option>
                </Select>
              )}
            </FormField>
          </div>
          <FormField label="Excerpt" hint="Short summary shown on cards and search.">
            {(fid) => <Input id={fid} value={form.excerpt} onChange={(e) => set('excerpt', e.target.value)} />}
          </FormField>
          <FormField label="Body" hint="Supports ## headings, - lists, and **bold**.">
            {(fid) => <Textarea id={fid} value={form.body} onChange={(e) => set('body', e.target.value)} className="min-h-48" />}
          </FormField>
          <FormField label="Order" className="w-28">
            {(fid) => <Input id={fid} type="number" value={form.order} onChange={(e) => set('order', Number(e.target.value))} />}
          </FormField>

          <div className="flex flex-wrap justify-end gap-2">
            <Button onClick={onSave} disabled={busy}>{isEdit ? 'Save changes' : 'Create draft'}</Button>
            {article && article.status !== 'published' && (
              <Button variant="secondary" disabled={busy} onClick={async () => { await publish.mutate(article.id); setVersion((v) => v + 1); }}>
                Publish
              </Button>
            )}
            {article && article.status === 'published' && (
              <Button variant="outline" disabled={busy} onClick={async () => { await unpublish.mutate(article.id); setVersion((v) => v + 1); }}>
                Unpublish
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {isEdit && (
        <Card>
          <CardHeader><CardTitle>Revisions</CardTitle></CardHeader>
          <CardContent>
            {(revisions.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No revisions yet. Editing this article records one.</p>
            ) : (
              <ol className="flex flex-col gap-2">
                {revisions.data?.map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="text-foreground">{r.title}</span>
                    <span className="text-xs text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
