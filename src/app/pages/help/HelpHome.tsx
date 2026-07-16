import { useCallback } from 'react';
import { Link } from 'react-router';
import { IconArrowRight, IconGavel } from '@tabler/icons-react';
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

      <section>
        <Link
          to="/help/legal"
          className="group flex items-center gap-4 rounded-2xl border border-border bg-card px-5 py-4 transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <IconGavel size={22} />
          </span>
          <span className="flex flex-col">
            <span className="font-semibold text-foreground group-hover:text-primary">
              Terms of Service & Policies
            </span>
            <span className="text-sm text-muted-foreground">
              Read our General Terms of Service and the annexes that form part of them.
            </span>
          </span>
          <IconArrowRight
            size={18}
            aria-hidden="true"
            className="ml-auto shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary"
          />
        </Link>
      </section>
    </div>
  );
}
