import { IconChevronDown, IconLock } from '@tabler/icons-react';
import { cn } from '../../lib/utils';

/**
 * Disabled brand selector. Shows "GGX" as the active (only) brand and previews
 * the multi-brand future without implying it works. Non-interactive by design
 * (Milestone-1 placeholder; functional multi-brand is deferred).
 */
export function BrandControl({ className }: { className?: string }) {
  return (
    <button
      type="button"
      disabled
      aria-disabled="true"
      title="More brands coming soon"
      className={cn(
        'inline-flex cursor-not-allowed items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-sm font-medium text-muted-foreground opacity-80',
        className,
      )}
    >
      <IconLock size={14} className="shrink-0" />
      <span>GGX</span>
      <IconChevronDown size={14} className="shrink-0 opacity-60" />
    </button>
  );
}
