import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import {
  listAllArticles,
  listAllCategories,
  publishArticle,
  unpublishArticle,
} from '../../services/kbService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { formatDate } from '../../lib/utils';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button, buttonVariants } from '../../components/ui/Button';
import { ErrorState, LoadingGrid } from '../../components/help/HelpStates';

/** KB administration: list every article with authoring actions. */
export function KbAdminList() {
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  const articles = useQuery(useCallback(() => listAllArticles(), []), [version]);
  const categories = useQuery(useCallback(() => listAllCategories(), []), []);
  const publish = useMutation(publishArticle);
  const unpublish = useMutation(unpublishArticle);

  const categoryName = (id: string) => categories.data?.find((c) => c.id === id)?.name ?? id;
  const busy = publish.loading || unpublish.loading;

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Knowledge Base"
        subtitle="Draft, revise, and publish help-center articles."
        action={
          <Link to="/admin/kb/new" className={buttonVariants({ variant: 'default' })}>
            New article
          </Link>
        }
      />

      {articles.error ? (
        <ErrorState onRetry={articles.refetch} />
      ) : articles.loading ? (
        <LoadingGrid count={3} />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Title</th>
                <th className="px-3 py-2 font-medium">Category</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Visibility</th>
                <th className="px-3 py-2 font-medium">Updated</th>
                <th className="px-3 py-2 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {articles.data?.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                  <td className="px-3 py-2">
                    <Link to={`/admin/kb/${a.id}`} className="font-medium text-primary hover:underline">{a.title}</Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{categoryName(a.kbCategoryId)}</td>
                  <td className="px-3 py-2">
                    <Badge variant={a.status === 'published' ? 'success' : 'default'}>{a.status}</Badge>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={a.visibility === 'internal' ? 'warning' : 'outline'}>{a.visibility}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(a.updatedAt)}</td>
                  <td className="px-3 py-2">
                    {a.status === 'published' ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={async () => { await unpublish.mutate(a.id); refresh(); }}>
                        Unpublish
                      </Button>
                    ) : (
                      <Button size="sm" disabled={busy} onClick={async () => { await publish.mutate(a.id); refresh(); }}>
                        Publish
                      </Button>
                    )}
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
