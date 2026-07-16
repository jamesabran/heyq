import type { ReactNode } from 'react';
import { IconChevronRight } from '@tabler/icons-react';
import { cn } from '../../lib/utils';

/**
 * A collapsible panel built on native <details>/<summary> — keyboard-accessible
 * and open-by-default togglable with zero JS state. Used to fold SECONDARY
 * evidence (metadata, timeline, resolution) so the conversation stays the primary
 * content in the review workspace.
 */
export function CollapsibleSection({
  title,
  meta,
  defaultOpen = false,
  children,
  className,
}: {
  title: ReactNode;
  /** Optional right-aligned summary shown on the header row (e.g. a count/badge). */
  meta?: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <details
      open={defaultOpen}
      className={cn('group rounded-xl border border-border bg-card text-card-foreground', className)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-foreground [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2">
          <IconChevronRight
            size={16}
            className="text-muted-foreground transition-transform group-open:rotate-90"
            aria-hidden="true"
          />
          {title}
        </span>
        {meta && <span className="text-xs font-normal text-muted-foreground">{meta}</span>}
      </summary>
      <div className="border-t border-border px-4 py-3">{children}</div>
    </details>
  );
}
