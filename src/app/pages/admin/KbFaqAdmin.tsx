import { useCallback, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { IconEye } from '@tabler/icons-react';
import {
  listAllArticles,
  listAllCategories,
  matchesStatusFilter,
  moveArticle,
  publishArticle,
  unpublishArticle,
  type MoveDirection,
} from '../../services/kbService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { richTextToPlainText } from '../../lib/richText';
import { cn, formatDate } from '../../lib/utils';
import type { KbArticle, KbCategory } from '../../models/kb';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button, buttonVariants } from '../../components/ui/Button';
import { KbSectionTabs } from '../../components/admin/KbSectionTabs';
import { KbFilterBar, type StatusFilter } from '../../components/admin/KbFilterBar';
import { ReorderButtons } from '../../components/admin/ReorderButtons';
import { CategoryIcon } from '../../components/help/CategoryIcon';
import { EmptyState, ErrorState, LoadingGrid } from '../../components/help/HelpStates';

/**
 * FAQ administration: every FAQ article grouped under its category, with search,
 * status filtering, publishing, and manual reordering within each category.
 *
 * Grouping is the point — an FAQ article's position only means something
 * relative to its category siblings, so a flat table would make the ordering
 * admins actually control impossible to see.
 */
export function KbFaqAdmin() {
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');

  const articles = useQuery(useCallback(() => listAllArticles(), []), [version]);
  const categories = useQuery(useCallback(() => listAllCategories(), []), [version]);

  const publish = useMutation(publishArticle);
  const unpublish = useMutation(unpublishArticle);
  const move = useMutation(moveArticle);
  const busy = publish.loading || unpublish.loading || move.loading;

  const groups = useMemo(
    () => groupByCategory(articles.data ?? [], categories.data ?? [], query, status),
    [articles.data, categories.data, query, status],
  );

  async function onMove(id: string, direction: MoveDirection) {
    await move.mutate(id, direction);
    refresh();
  }

  const hasResults = groups.some((g) => g.articles.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title="Knowledge Base"
        subtitle="Draft, revise, and publish help-center content."
        action={
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/kb/faqs/categories" className={buttonVariants({ variant: 'outline' })}>
              Manage categories
            </Link>
            <Link to="/admin/kb/faqs/new" className={buttonVariants({ variant: 'default' })}>
              New FAQ
            </Link>
          </div>
        }
      />

      <KbSectionTabs />

      <KbFilterBar
        query={query}
        onQueryChange={setQuery}
        status={status}
        onStatusChange={setStatus}
        searchLabel="Search FAQs"
        placeholder="Search FAQ questions and answers…"
      />

      {articles.error ? (
        <ErrorState onRetry={articles.refetch} />
      ) : articles.loading || categories.loading ? (
        <LoadingGrid count={3} />
      ) : !hasResults ? (
        <EmptyState title="No FAQs match">
          Try a different search term or status filter.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-6">
          {groups
            .filter((group) => group.articles.length > 0)
            .map((group) => (
              <CategoryGroup
                key={group.category.id}
                category={group.category}
                articles={group.articles}
                // Reordering compares against the full category, not the filtered
                // view: the first visible row may not be the first row, and
                // enabling "up" on it would silently move a hidden article.
                orderedIds={group.orderedIds}
                busy={busy}
                onMove={onMove}
                onPublish={async (id) => { await publish.mutate(id); refresh(); }}
                onUnpublish={async (id) => { await unpublish.mutate(id); refresh(); }}
              />
            ))}
        </div>
      )}
    </div>
  );
}

interface CategoryGroupProps {
  category: KbCategory;
  articles: KbArticle[];
  orderedIds: string[];
  busy: boolean;
  onMove: (id: string, direction: MoveDirection) => void;
  onPublish: (id: string) => void;
  onUnpublish: (id: string) => void;
}

function CategoryGroup({
  category, articles, orderedIds, busy, onMove, onPublish, onUnpublish,
}: CategoryGroupProps) {
  const isSubcategory = category.parentId !== null;
  return (
    <section className={cn('flex flex-col gap-2', isSubcategory && 'ml-6 border-l-2 border-border pl-4')}>
      <header className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
          <CategoryIcon category={category} size={16} />
        </span>
        <h2 className="font-semibold text-foreground">{category.name}</h2>
        <Badge variant="outline">{articles.length}</Badge>
      </header>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[760px] text-sm">
          <caption className="sr-only">FAQ articles in {category.name}</caption>
          <thead className="border-b border-border bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th scope="col" className="w-12 px-3 py-2 font-medium">Order</th>
              <th scope="col" className="px-3 py-2 font-medium">Question</th>
              <th scope="col" className="px-3 py-2 font-medium">Status</th>
              <th scope="col" className="px-3 py-2 font-medium">Visibility</th>
              <th scope="col" className="px-3 py-2 font-medium">Last updated</th>
              <th scope="col" className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {articles.map((article) => (
              <tr key={article.id} className="border-b border-border last:border-0 hover:bg-accent/50">
                <td className="px-3 py-2">
                  <ReorderButtons
                    label={article.title}
                    disabled={busy}
                    disableUp={orderedIds[0] === article.id}
                    disableDown={orderedIds[orderedIds.length - 1] === article.id}
                    onMove={(direction) => onMove(article.id, direction)}
                  />
                </td>
                <td className="px-3 py-2">
                  <Link to={`/admin/kb/faqs/${article.id}`} className="font-medium text-primary hover:underline">
                    {article.title}
                  </Link>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={article.status === 'published' ? 'success' : 'default'}>{article.status}</Badge>
                </td>
                <td className="px-3 py-2">
                  <Badge variant={article.visibility === 'internal' ? 'warning' : 'outline'}>{article.visibility}</Badge>
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDate(article.updatedAt)}</td>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <Link
                      to={`/admin/kb/faqs/${article.id}?view=preview`}
                      aria-label={`Preview ${article.title}`}
                      className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                    >
                      <IconEye size={15} aria-hidden="true" />
                      Preview
                    </Link>
                    {article.status === 'published' ? (
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => onUnpublish(article.id)}>
                        Unpublish
                      </Button>
                    ) : (
                      <Button size="sm" disabled={busy} onClick={() => onPublish(article.id)}>
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
    </section>
  );
}

interface CategoryGroupData {
  category: KbCategory;
  /** Articles passing the current filters, in manual order. */
  articles: KbArticle[];
  /** Every article id in the category in manual order — the reorder boundary. */
  orderedIds: string[];
}

/**
 * Categories in reading order: each top-level category followed by its own
 * subcategories. `order` is scoped to siblings, so sorting the flat list by it
 * would drop a subcategory among the top-level ones.
 */
function inTreeOrder(categories: KbCategory[]): KbCategory[] {
  return categories
    .filter((c) => c.parentId === null)
    .flatMap((parent) => [parent, ...categories.filter((c) => c.parentId === parent.id)]);
}

/** Group articles under their category, applying the search and status filters. */
function groupByCategory(
  articles: KbArticle[],
  categories: KbCategory[],
  query: string,
  status: StatusFilter,
): CategoryGroupData[] {
  const q = query.trim().toLowerCase();

  return inTreeOrder(categories).map((category) => {
    const inCategory = articles.filter((a) => a.kbCategoryId === category.id);
    return {
      category,
      orderedIds: inCategory.map((a) => a.id),
      articles: inCategory.filter((article) => {
        if (!matchesStatusFilter(article.status, status)) return false;
        if (!q) return true;
        // Search the answer's text, not its markup, so a query never matches a tag.
        const haystack = `${article.title} ${article.excerpt} ${richTextToPlainText(article.body)}`;
        return haystack.toLowerCase().includes(q);
      }),
    };
  });
}
