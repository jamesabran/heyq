import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import {
  createLegalDocument,
  getLegalDocumentForEdit,
  listLinkTargets,
  listRevisions,
  publishLegalDocument,
  unpublishLegalDocument,
  updateLegalDocument,
} from '../../services/kbService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { useIdentity } from '../../contexts/IdentityContext';
import type { KbLegalKind } from '../../models/kb';
import { extractSections } from '../../lib/richText';
import { formatDateTime } from '../../lib/utils';
import { PageHeader } from '../../components/layout/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { RichTextEditor } from '../../components/editor/RichTextEditor';
import { RichTextContent } from '../../components/help/RichTextContent';
import { LegalTableOfContents } from '../../components/help/LegalTableOfContents';
import { EditorModeTabs, type EditorMode } from '../../components/admin/EditorModeTabs';
import { EmptyState, LoadingGrid } from '../../components/help/HelpStates';

interface FormState {
  title: string;
  kind: KbLegalKind;
  summary: string;
  body: string;
}

const BLANK: FormState = { title: '', kind: 'annex', summary: '', body: '' };

/**
 * Editor for a single legal document — the General TOS or one annex. Each annex
 * is edited here as its own document; the TOS never absorbs them into one body.
 */
export function KbLegalEditor() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const { identity } = useIdentity();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [version, setVersion] = useState(0);

  const mode: EditorMode = searchParams.get('view') === 'preview' ? 'preview' : 'edit';
  const setMode = (next: EditorMode) =>
    setSearchParams(next === 'preview' ? { view: 'preview' } : {}, { replace: true });

  const linkTargets = useQuery(useCallback(() => listLinkTargets(), []), []);
  const existing = useQuery(
    useCallback(() => (id ? getLegalDocumentForEdit(id) : Promise.resolve(null)), [id]),
    [id, version],
  );
  const revisions = useQuery(
    useCallback(() => (id ? listRevisions(id) : Promise.resolve([])), [id]),
    [id, version],
  );

  const create = useMutation(createLegalDocument);
  const update = useMutation(updateLegalDocument);
  const publish = useMutation(publishLegalDocument);
  const unpublish = useMutation(unpublishLegalDocument);

  const [form, setForm] = useState<FormState>(BLANK);
  const [hydratedFor, setHydratedFor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const doc = existing.data;

  // Sections drive the anchors other documents link to, so an editor needs to
  // see the names their `#section` links have to match.
  const sections = useMemo(() => extractSections(form.body), [form.body]);

  useEffect(() => {
    if (doc) {
      setForm({ title: doc.title, kind: doc.kind, summary: doc.summary, body: doc.body });
      setHydratedFor(doc.id);
    }
  }, [doc]);

  if (isEdit && existing.loading) return <LoadingGrid count={2} />;
  if (isEdit && !doc) {
    return <EmptyState title="Document not found">This legal document doesn&apos;t exist.</EmptyState>;
  }
  // Wait for the form to catch up with the loaded document before rendering. The
  // body editor is uncontrolled and seeds itself on mount, so mounting it a
  // render early would seed it from the blank form and leave it empty.
  if (isEdit && hydratedFor !== id) return <LoadingGrid count={2} />;

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    setSaved(false);
  };

  async function onSave() {
    if (!form.title.trim()) { setError('Title is required.'); return; }
    setError('');
    if (isEdit && id) {
      await update.mutate(id, identity.id, form);
      setVersion((v) => v + 1);
      setSaved(true);
    } else {
      const created = await create.mutate(form, identity.id);
      navigate(`/admin/kb/legal/${created.id}`);
    }
  }

  const busy = create.loading || update.loading || publish.loading || unpublish.loading;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        title={isEdit ? 'Edit legal document' : 'New legal document'}
        subtitle={<Link to="/admin/kb/legal" className="text-primary hover:underline">← Back to TOS &amp; Policies</Link>}
        action={
          doc ? (
            <div className="flex items-center gap-2">
              <Badge variant={doc.status === 'published' ? 'success' : 'default'}>{doc.status}</Badge>
              <Badge variant="outline">{doc.kind === 'tos' ? 'General TOS' : 'Annex'}</Badge>
            </div>
          ) : undefined
        }
      />

      {saved && <Alert variant="success">Changes saved. A revision was recorded.</Alert>}
      {error && <Alert variant="destructive">{error}</Alert>}

      <EditorModeTabs mode={mode} onChange={setMode} />

      {mode === 'preview' ? (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <h1 className="text-2xl font-bold text-foreground">{form.title || 'Untitled document'}</h1>
            {form.summary && <p className="text-muted-foreground">{form.summary}</p>}
            {sections.length > 1 && <LegalTableOfContents sections={sections} />}
            {/* Rendered exactly as the public route renders it, anchors included. */}
            <RichTextContent body={form.body} withAnchors />
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="flex flex-col gap-4 pt-6">
            <FormField label="Title">
              {(fid) => <Input id={fid} value={form.title} onChange={(e) => set('title', e.target.value)} />}
            </FormField>
            <FormField
              label="Document type"
              className="sm:w-64"
              hint="The General TOS is the master agreement; annexes form part of it."
            >
              {(fid) => (
                <Select id={fid} value={form.kind} onChange={(e) => set('kind', e.target.value as KbLegalKind)}>
                  <option value="tos">General Terms of Service</option>
                  <option value="annex">Annex / policy</option>
                </Select>
              )}
            </FormField>
            <FormField label="Summary" hint="One line shown on the TOS & Policies index.">
              {(fid) => <Input id={fid} value={form.summary} onChange={(e) => set('summary', e.target.value)} />}
            </FormField>
            <FormField label="Document body" hint="Use the toolbar for headings, numbered clauses, indentation, and links.">
              {(fid) => (
                <RichTextEditor
                  id={fid}
                  ariaLabel="Document body"
                  value={form.body}
                  // Rolls on every save, so the editor re-seeds with the stored,
                  // sanitized body rather than the raw markup the browser left.
                  documentKey={doc ? `${doc.id}:${doc.updatedAt}` : 'new'}
                  linkTargets={linkTargets.data}
                  onChange={(html) => set('body', html)}
                  className="min-h-96"
                />
              )}
            </FormField>

            <div className="flex flex-wrap justify-end gap-2">
              <Button onClick={onSave} disabled={busy}>{isEdit ? 'Save changes' : 'Create draft'}</Button>
              {doc && doc.status !== 'published' && (
                <Button variant="secondary" disabled={busy} onClick={async () => { await publish.mutate(doc.id); setVersion((v) => v + 1); }}>
                  Publish
                </Button>
              )}
              {doc && doc.status === 'published' && (
                <Button variant="outline" disabled={busy} onClick={async () => { await unpublish.mutate(doc.id); setVersion((v) => v + 1); }}>
                  Unpublish
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {mode === 'edit' && sections.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Linkable sections</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              Other documents can link straight to a section by appending its anchor
              to this document&apos;s link.
            </p>
            <ul className="flex flex-col gap-1.5">
              {sections.map((section) => (
                <li key={section.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                  <span className="text-foreground">{section.text}</span>
                  <code className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    #{section.id}
                  </code>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {isEdit && (
        <Card>
          <CardHeader><CardTitle>Revisions</CardTitle></CardHeader>
          <CardContent>
            {(revisions.data?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No revisions yet. Editing this document records one.</p>
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
