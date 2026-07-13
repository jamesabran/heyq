import { Fragment } from 'react';
import { Link } from 'react-router';
import { IconChevronRight } from '@tabler/icons-react';
import { cn } from '../../lib/utils';

export interface Crumb {
  label: string;
  to?: string;
}

/** Breadcrumb trail. The last crumb renders as the current page (no link). */
export function Breadcrumb({ items, className }: { items: Crumb[]; className?: string }) {
  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm', className)}>
      <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
        {items.map((item, i) => {
          const isLast = i === items.length - 1;
          return (
            <Fragment key={`${item.label}-${i}`}>
              <li>
                {item.to && !isLast ? (
                  <Link to={item.to} className="hover:text-foreground hover:underline">
                    {item.label}
                  </Link>
                ) : (
                  <span className={cn(isLast && 'font-medium text-foreground')} aria-current={isLast ? 'page' : undefined}>
                    {item.label}
                  </span>
                )}
              </li>
              {!isLast && (
                <li aria-hidden="true">
                  <IconChevronRight size={14} />
                </li>
              )}
            </Fragment>
          );
        })}
      </ol>
    </nav>
  );
}
