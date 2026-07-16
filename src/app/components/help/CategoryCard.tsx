import { Link } from 'react-router';
import type { KbCategory } from '../../models/kb';
import { Card, CardContent } from '../ui/Card';
import { CategoryIcon } from './CategoryIcon';

/** Link card for a KB category on the help home grid. */
export function CategoryCard({ category }: { category: KbCategory }) {
  return (
    <Link to={`/help/c/${category.slug}`} className="group block focus-visible:outline-none">
      <Card className="h-full transition-colors group-hover:border-primary/40 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardContent className="flex h-full flex-col gap-2 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <CategoryIcon category={category} />
          </span>
          <h3 className="mt-1 font-semibold text-foreground group-hover:text-primary">{category.name}</h3>
          {category.description && (
            <p className="text-sm text-muted-foreground">{category.description}</p>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
