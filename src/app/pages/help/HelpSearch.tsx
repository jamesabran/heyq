import { useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { searchArticles } from '../../services/kbService';
import { useQuery } from '../../hooks/useQuery';
import { ArticleCard } from '../../components/help/ArticleCard';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { HelpSearchBox } from '../../components/help/HelpSearchBox';
import { EmptyState, ErrorState, LoadingGrid } from '../../components/help/HelpStates';

/** Help-center search results, driven by the `?q=` query parameter. */
export function HelpSearch() {
  const [params] = useSearchParams();
  const query = params.get('q') ?? '';

  const results = useQuery(useCallback(() => searchArticles(query), [query]), [query]);
  const count = results.data?.length ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb items={[{ label: 'Help Center', to: '/help' }, { label: 'Search' }]} />

      <div className="max-w-xl">
        <HelpSearchBox initialQuery={query} autoFocus />
      </div>

      {query.trim() === '' ? (
        <EmptyState title="Search the help center">
          Type a question or keyword above to find articles.
        </EmptyState>
      ) : results.error ? (
        <ErrorState onRetry={results.refetch} />
      ) : results.loading ? (
        <LoadingGrid count={3} />
      ) : count === 0 ? (
        <EmptyState title="No results found">
          No articles match “{query}”. Try different keywords.
        </EmptyState>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            {count} result{count === 1 ? '' : 's'} for “{query}”
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.data?.map((article) => (
              <ArticleCard key={article.id} article={article} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
