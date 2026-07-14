import { useCallback } from 'react';
import { listFeaturedArticles, listTopLevelCategories } from '../../services/kbService';
import { useQuery } from '../../hooks/useQuery';
import { ArticleCard } from '../../components/help/ArticleCard';
import { CategoryCard } from '../../components/help/CategoryCard';
import { HelpSearchBox } from '../../components/help/HelpSearchBox';
import { ErrorState, LoadingGrid } from '../../components/help/HelpStates';

/** Public help center home: search hero, featured articles, and category grid. */
export function HelpHome() {
  const categories = useQuery(useCallback(() => listTopLevelCategories(), []), []);
  const featured = useQuery(useCallback(() => listFeaturedArticles(), []), []);

  return (
    <div className="flex flex-col gap-10">
      <section className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <h1 className="text-3xl font-bold text-foreground sm:text-4xl">How can we help?</h1>
        <p className="max-w-xl text-muted-foreground">
          Search our guides or browse a category to get answers about bookings,
          deliveries, payments, and more.
        </p>
        <div className="w-full max-w-xl">
          <HelpSearchBox />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-foreground">Featured articles</h2>
        {featured.error ? (
          <ErrorState onRetry={featured.refetch} />
        ) : featured.loading ? (
          <LoadingGrid count={3} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.data?.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-semibold text-foreground">Browse by category</h2>
        {categories.error ? (
          <ErrorState onRetry={categories.refetch} />
        ) : categories.loading ? (
          <LoadingGrid />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.data?.map((category) => (
              <CategoryCard key={category.id} category={category} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
