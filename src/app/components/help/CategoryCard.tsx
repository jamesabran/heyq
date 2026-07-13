import { Link } from 'react-router';
import {
  IconBolt,
  IconCash,
  IconDeviceMobile,
  IconFolder,
  IconPackage,
  IconRocket,
  IconTruck,
  IconUser,
} from '@tabler/icons-react';
import type { KbCategory } from '../../models/kb';
import { Card, CardContent } from '../ui/Card';

// Explicit map (keeps tree-shaking working — no wildcard icon import). Falls back
// to a folder icon for any unmapped name.
const CATEGORY_ICONS: Record<string, typeof IconFolder> = {
  IconRocket,
  IconUser,
  IconTruck,
  IconBolt,
  IconCash,
  IconPackage,
  IconDeviceMobile,
};

/** Link card for a KB category on the help home grid. */
export function CategoryCard({ category }: { category: KbCategory }) {
  const Icon = (category.icon && CATEGORY_ICONS[category.icon]) || IconFolder;
  return (
    <Link to={`/help/c/${category.slug}`} className="group block focus-visible:outline-none">
      <Card className="h-full transition-colors group-hover:border-primary/40 group-focus-visible:ring-2 group-focus-visible:ring-ring">
        <CardContent className="flex h-full flex-col gap-2 p-5">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon size={22} />
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
