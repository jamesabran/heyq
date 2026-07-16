import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { IconEye, IconFileText, IconGavel } from '@tabler/icons-react';
import {
  listAllLegalDocuments,
  matchesStatusFilter,
  moveLegalDocument,
  publishLegalDocument,
  unpublishLegalDocument,
  type MoveDirection,
} from '../../services/kbService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { richTextToPlainText } from '../../lib/richText';
import { formatDate } from '../../lib/utils';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button, buttonVariants } from '../../components/ui/Button';
import { KbSectionTabs } from '../../components/admin/KbSectionTabs';
import { KbFilterBar, type StatusFilter } from '../../components/admin/KbFilterBar';
import { ReorderButtons } from '../../components/admin/ReorderButtons';
import { EmptyState, ErrorState, LoadingGrid } from '../../components/help/HelpStates';

/**
 * TOS and Policies administration: the General TOS and every annex in one
 * ordered list.
 *
 * There is no fixed number of annexes and no pinned position for the TOS — the
 * list is whatever admins have created and arranged, and the TOS moves with the
 * same controls as anything else.
 */
export function KbLegalAdmin() {
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const documents = useQuery(useCallback(() => listAllLegalDocuments(), []), [version]);
  const publish = useMutation(publishLegalDocument);
  const unpublish = useMutation(unpublishLegalDocument);
  const move = useMutation(moveLegalDocument);
  const busy = publish.loading || unpublish.loading || move.loading;

  const all = useMemo(() => documents.data ?? [], [documents.data]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((doc) => {
      if (!matchesStatusFilter(doc.status, status)) return false;
      if (!q) return true;
      return `${doc.title} ${doc.summary} ${richTextToPlainText(doc.body)}`.toLowerCase().includes(q);
    });
  }, [all, query, status]);

  async function onMove(id: string, direction: MoveDirection) {
    await move.mutate(id, direction);
    refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Knowledge Base"
        subtitle="Draft, revise, and publish help-center content."
        action={
          <Link to="/admin/kb/legal/new" className={buttonVariants({ variant: 'default' })}>
            New document
          </Link>
        }
      />

      <KbSectionTabs />

      <KbFilterBar
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        searchLabel="Search TOS and policies"
        placeholder="Search legal documents…"
      />

      {documents.error ? (
        <ErrorState onRetry={documents.refetch} />
      ) : documents.loading ? (
        <LoadingGrid count={3} />
      ) : visible.length === 0 ? (
        <EmptyState title="No documents match">
          Try a different search term or status filter.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[760px] text-sm">
            <caption className="sr-only">Terms of Service and policy documents</caption>
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th scope="col" className="w-12 px-3 py-2 font-medium">Order</th>
                <th scope="col" className="px-3 py-2 font-medium">Document</th>
                <th scope="col" className="px-3 py-2 font-medium">Type</th>
                <th scope="col" className="px-3 py-2 font-medium">Status</th>
                <th scope="col" className="px-3 py-2 font-medium">Last updated</th>
                <th scope="col" className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((doc) => (
                <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                  <td className="px-3 py-2">
                    <ReorderButtons
                      label={doc.title}
                      disabled={busy}
                      // Bounds come from the full list, not the filtered view, so
                      // a filtered-out neighbour is never skipped over silently.
                      disableUp={all[0]?.id === doc.id}
                      disableDown={all[all.length - 1]?.id === doc.id}
                      onMove={(direction) => onMove(doc.id, direction)}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">
                        {doc.kind === 'tos' ? <IconGavel size={16} /> : <IconFileText size={16} />}
                      </span>
                      <div className="flex flex-col">
                        <Link to={`/admin/kb/legal/${doc.id}`} className="font-medium text-primary hover:underline">
                          {doc.title}
                        </Link>
                        <span className="text-xs text-muted-foreground">{doc.summary}</span>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    <Badge variant={doc.kind === 'tos' ? 'brand' : 'outline'}>
                      {doc.kind === 'tos' ? 'General TOS' : 'Annex'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={doc.status === 'published' ? 'success' : 'default'}>{doc.status}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(doc.updatedAt)}</td>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      <Link
                        to={`/admin/kb/legal/${doc.id}?view=preview`}
                        aria-label={`Preview ${doc.title}`}
                        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                      >
                        <IconEye size={15} aria-hidden="true" />
                        Preview
                      </Link>
                      {doc.status === 'published' ? (
                        <Button size="sm" variant="outline" disabled={busy} onClick={async () => { await unpublish.mutate(doc.id); refresh(); }}>
                          Unpublish
                        </Button>
                      ) : (
                        <Button size="sm" disabled={busy} onClick={async () => { await publish.mutate(doc.id); refresh(); }}>
                          Publish
                        </Button>
                      )}
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
