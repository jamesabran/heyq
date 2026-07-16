import { useCallback, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { IconTrash, IconUpload, IconX } from '@tabler/icons-react';
import {
  createCategory,
  deleteCategory,
  listAllCategories,
  moveCategory,
  updateCategory,
  type MoveDirection,
} from '../../services/kbService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import type { KbCategory } from '../../models/kb';
import { PageHeader } from '../../components/layout/PageHeader';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { FormField } from '../../components/ui/FormField';
import { Input } from '../../components/ui/Input';
import { Select } from '../../components/ui/Select';
import { KbSectionTabs } from '../../components/admin/KbSectionTabs';
import { ReorderButtons } from '../../components/admin/ReorderButtons';
import { CategoryIcon, CATEGORY_ICON_NAMES } from '../../components/help/CategoryIcon';
import { ErrorState, LoadingGrid } from '../../components/help/HelpStates';

/** Uploaded icons are inlined as data URLs, so keep them small. */
const MAX_ICON_BYTES = 200 * 1024;

/**
 * FAQ category administration: create, rename, assign icons, and reorder.
 *
 * Categories are ordered manually and independently of their articles — moving a
 * category never touches the articles inside it, and vice versa.
 */
export function KbCategoriesAdmin() {
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  const [error, setError] = useState('');
  const [newName, setNewName] = useState('');
  const [newParentId, setNewParentId] = useState('');

  const categories = useQuery(useCallback(() => listAllCategories(), []), [version]);
  const create = useMutation(createCategory);
  const update = useMutation(updateCategory);
  const move = useMutation(moveCategory);
  const remove = useMutation(deleteCategory);
  const busy = create.loading || update.loading || move.loading || remove.loading;

  const all = useMemo(() => categories.data ?? [], [categories.data]);
  const topLevel = useMemo(() => all.filter((c) => c.parentId === null), [all]);

  async function run(action: () => Promise<unknown>) {
    setError('');
    try {
      await action();
      refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function onCreate() {
    if (!newName.trim()) { setError('Category name is required.'); return; }
    await run(async () => {
      await create.mutate({ name: newName, parentId: newParentId || null });
      setNewName('');
      setNewParentId('');
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="FAQ categories"
        subtitle={<Link to="/admin/kb/faqs" className="text-primary hover:underline">← Back to FAQs</Link>}
      />

      <KbSectionTabs />

      {error && <Alert variant="destructive">{error}</Alert>}

      <Card>
        <CardHeader><CardTitle>Add a category</CardTitle></CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-3">
            <FormField label="Name" className="min-w-56 flex-1">
              {(fid) => (
                <Input
                  id={fid}
                  value={newName}
                  placeholder="e.g. Seller Tools"
                  onChange={(e) => setNewName(e.target.value)}
                />
              )}
            </FormField>
            <FormField label="Parent category" className="w-56" hint="Leave blank for a top-level category.">
              {(fid) => (
                <Select id={fid} value={newParentId} onChange={(e) => setNewParentId(e.target.value)}>
                  <option value="">None (top level)</option>
                  {topLevel.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </Select>
              )}
            </FormField>
            <Button disabled={busy} onClick={onCreate}>Add category</Button>
          </div>
        </CardContent>
      </Card>

      {categories.error ? (
        <ErrorState onRetry={categories.refetch} />
      ) : categories.loading ? (
        <LoadingGrid count={3} />
      ) : (
        <div className="flex flex-col gap-3">
          {topLevel.map((category) => (
            <div key={category.id} className="flex flex-col gap-3">
              <CategoryRow
                category={category}
                busy={busy}
                disableUp={topLevel[0]?.id === category.id}
                disableDown={topLevel[topLevel.length - 1]?.id === category.id}
                onMove={(direction) => run(() => move.mutate(category.id, direction))}
                onUpdate={(changes) => run(() => update.mutate(category.id, changes))}
                onDelete={() => run(() => remove.mutate(category.id))}
              />
              <Subcategories
                parentId={category.id}
                all={all}
                busy={busy}
                onMove={(id, direction) => run(() => move.mutate(id, direction))}
                onUpdate={(id, changes) => run(() => update.mutate(id, changes))}
                onDelete={(id) => run(() => remove.mutate(id))}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Subcategories({
  parentId, all, busy, onMove, onUpdate, onDelete,
}: {
  parentId: string;
  all: KbCategory[];
  busy: boolean;
  onMove: (id: string, direction: MoveDirection) => void;
  onUpdate: (id: string, changes: Parameters<typeof updateCategory>[1]) => void;
  onDelete: (id: string) => void;
}) {
  const subs = all.filter((c) => c.parentId === parentId);
  if (subs.length === 0) return null;

  return (
    <div className="ml-6 flex flex-col gap-3 border-l-2 border-border pl-4">
      {subs.map((sub) => (
        <CategoryRow
          key={sub.id}
          category={sub}
          busy={busy}
          disableUp={subs[0]?.id === sub.id}
          disableDown={subs[subs.length - 1]?.id === sub.id}
          onMove={(direction) => onMove(sub.id, direction)}
          onUpdate={(changes) => onUpdate(sub.id, changes)}
          onDelete={() => onDelete(sub.id)}
        />
      ))}
    </div>
  );
}

interface CategoryRowProps {
  category: KbCategory;
  busy: boolean;
  disableUp: boolean;
  disableDown: boolean;
  onMove: (direction: MoveDirection) => void;
  onUpdate: (changes: Parameters<typeof updateCategory>[1]) => void;
  onDelete: () => void;
}

function CategoryRow({ category, busy, disableUp, disableDown, onMove, onUpdate, onDelete }: CategoryRowProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadError, setUploadError] = useState('');

  async function onFile(file: File | undefined) {
    if (!file) return;
    setUploadError('');
    if (!file.type.startsWith('image/')) {
      setUploadError('Choose an image file.');
      return;
    }
    if (file.size > MAX_ICON_BYTES) {
      setUploadError('Icon must be under 200 KB.');
      return;
    }
    onUpdate({ name: category.name, iconUrl: await readAsDataUrl(file) });
  }

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-3 p-4">
        <ReorderButtons
          label={category.name}
          disabled={busy}
          disableUp={disableUp}
          disableDown={disableDown}
          onMove={onMove}
        />

        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border bg-primary/10 text-primary">
          <CategoryIcon category={category} size={22} />
        </span>

        <div className="flex min-w-48 flex-1 flex-col gap-1">
          <Input
            aria-label={`Name for ${category.name}`}
            defaultValue={category.name}
            disabled={busy}
            onBlur={(e) => {
              if (e.target.value.trim() && e.target.value !== category.name) {
                onUpdate({ name: e.target.value });
              }
            }}
          />
          <Input
            aria-label={`Description for ${category.name}`}
            className="h-8 py-0 text-xs"
            placeholder="Description (optional)"
            defaultValue={category.description ?? ''}
            disabled={busy}
            onBlur={(e) => {
              if (e.target.value !== (category.description ?? '')) {
                onUpdate({ name: category.name, description: e.target.value });
              }
            }}
          />
        </div>

        <div className="flex flex-col gap-1">
          <Select
            aria-label={`Built-in icon for ${category.name}`}
            className="h-8 w-44 py-0 text-xs"
            value={category.icon ?? ''}
            disabled={busy}
            onChange={(e) => onUpdate({ name: category.name, icon: e.target.value })}
          >
            <option value="">No built-in icon</option>
            {CATEGORY_ICON_NAMES.map((name) => (
              <option key={name} value={name}>{name.replace(/^Icon/, '')}</option>
            ))}
          </Select>
          <div className="flex items-center gap-1">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              tabIndex={-1}
              aria-hidden="true"
              className="hidden"
              onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }}
            />
            <Button
              size="sm"
              variant="outline"
              aria-label={`Upload an icon for ${category.name}`}
              disabled={busy}
              onClick={() => fileRef.current?.click()}
            >
              <IconUpload size={14} aria-hidden="true" />
              Upload icon
            </Button>
            {category.iconUrl && (
              <Button
                size="sm"
                variant="ghost"
                aria-label={`Remove uploaded icon for ${category.name}`}
                disabled={busy}
                // '' clears the upload and falls back to the built-in glyph.
                onClick={() => onUpdate({ name: category.name, iconUrl: '' })}
              >
                <IconX size={14} aria-hidden="true" />
              </Button>
            )}
          </div>
          {uploadError && <p role="alert" className="text-xs font-medium text-destructive">{uploadError}</p>}
        </div>

        <Button
          size="sm"
          variant="ghost"
          aria-label={`Delete ${category.name}`}
          disabled={busy}
          onClick={onDelete}
        >
          <IconTrash size={15} aria-hidden="true" />
        </Button>
      </CardContent>
    </Card>
  );
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(file);
  });
}
