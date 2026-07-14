import { useCallback } from 'react';
import { useParams } from 'react-router';
import { IconClock } from '@tabler/icons-react';
import {
  getArticleBySlug,
  getCategoryById,
  listRelatedArticles,
} from '../../services/kbService';
import { useQuery } from '../../hooks/useQuery';
import { formatDate } from '../../lib/utils';
import { ArticleBody } from '../../components/help/ArticleBody';
import { ArticleCard } from '../../components/help/ArticleCard';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Separator } from '../../components/ui/Separator';
import { BackToHelpLink, EmptyState, ErrorState, LoadingGrid } from '../../components/help/HelpStates';

/** Public article view: breadcrumb, last-updated, body, and related articles. */
export function HelpArticle() {
  const { slug = '' } = useParams();

  const article = useQuery(useCallback(() => getArticleBySlug(slug), [slug]), [slug]);
  const art = article.data;

  const category = useQuery(
    useCallback(() => (art ? getCategoryById(art.kbCategoryId) : Promise.resolve(null)), [art]),
    [art?.kbCategoryId],
  );
  const related = useQuery(
    useCallback(() => (art ? listRelatedArticles(art) : Promise.resolve([])), [art]),
    [art?.id],
  );

  if (article.error) {
    return <ErrorState onRetry={article.refetch} />;
  }
  if (article.loading) {
    return <LoadingGrid count={3} />;
  }

  if (!art) {
    // Also the path for internal/draft slugs — the service resolves them to null,
    // so they can never render in the public help center.
    return (
      <EmptyState title="Article not available" action={<BackToHelpLink />}>
        This article doesn&apos;t exist or isn&apos;t publicly available.
      </EmptyState>
    );
  }

  return (
    <article className="mx-auto flex max-w-3xl flex-col gap-6">
      <Breadcrumb
        items={[
          { label: 'Help Center', to: '/help' },
          ...(category.data ? [{ label: category.data.name, to: `/help/c/${category.data.slug}` }] : []),
          { label: art.title },
        ]}
      />

      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold text-foreground">{art.title}</h1>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <IconClock size={15} aria-hidden="true" />
          Last updated {formatDate(art.updatedAt)}
        </p>
      </header>

      <Separator />
      <ArticleBody body={art.body} />

      {(related.data?.length ?? 0) > 0 && (
        <>
          <Separator />
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground">Related articles</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              {related.data?.map((r) => (
                <ArticleCard key={r.id} article={r} />
              ))}
            </div>
          </section>
        </>
      )}
    </article>
  );
}
