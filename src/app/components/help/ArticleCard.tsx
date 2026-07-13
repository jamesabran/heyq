import { Link } from 'react-router';
import { IconArrowRight } from '@tabler/icons-react';
import type { KbArticle } from '../../models/kb';
import { formatDate } from '../../lib/utils';
import { Card, CardContent } from '../ui/Card';

/** Compact link card for an article, used in grids, related lists, and search. */
export function ArticleCard({ article }: { article: KbArticle }) {
  return (
    <Link to={`/help/a/${article.slug}`} className="group block focus-visible:outline-none">
      <Card className="h-full transition-colors group-hover:border-primary/40 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardContent className="flex h-full flex-col gap-2 p-4">
          <h3 className="font-medium text-foreground group-hover:text-primary">{article.title}</h3>
          <p className="line-clamp-2 flex-1 text-sm text-muted-foreground">{article.excerpt}</p>
          <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
            <span>Updated {formatDate(article.updatedAt)}</span>
            <IconArrowRight size={14} className="opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
