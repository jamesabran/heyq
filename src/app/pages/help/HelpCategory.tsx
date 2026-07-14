import { useCallback } from 'react';
import { useParams } from 'react-router';
import {
  getCategoryBySlug,
  listArticlesByCategory,
  listSubcategories,
} from '../../services/kbService';
import { useQuery } from '../../hooks/useQuery';
import { ArticleCard } from '../../components/help/ArticleCard';
import { CategoryCard } from '../../components/help/CategoryCard';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { BackToHelpLink, EmptyState, ErrorState, LoadingGrid } from '../../components/help/HelpStates';

/** Category / subcategory listing: subcategories + articles in the category. */
export function HelpCategory() {
  const { category: slug = '' } = useParams();

  const category = useQuery(useCallback(() => getCategoryBySlug(slug), [slug]), [slug]);
  const cat = category.data;

  const subcategories = useQuery(
    useCallback(() => (cat ? listSubcategories(cat.id) : Promise.resolve([])), [cat]),
    [cat?.id],
  );
  const articles = useQuery(
    useCallback(() => (cat ? listArticlesByCategory(cat.id) : Promise.resolve([])), [cat]),
    [cat?.id],
  );

  if (category.error) {
    return <ErrorState onRetry={category.refetch} />;
  }
  if (category.loading) {
    return <LoadingGrid />;
  }

  if (!cat) {
    return (
      <EmptyState title="Category not found" action={<BackToHelpLink />}>
        We couldn&apos;t find that category. It may have been moved or renamed.
      </EmptyState>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Help Center', to: '/help' }, { label: cat.name }]} />

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">{cat.name}</h1>
        {cat.description && <p className="text-muted-foreground">{cat.description}</p>}
      </header>

      {(subcategories.data?.length ?? 0) > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Subcategories
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {subcategories.data?.map((sub) => (
              <CategoryCard key={sub.id} category={sub} />
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Articles
        </h2>
        {articles.loading ? (
          <LoadingGrid count={3} />
        ) : (articles.data?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No articles in this category yet.</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.data?.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
