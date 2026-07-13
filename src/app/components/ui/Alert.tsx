import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

// `brand` uses the QuadX primary; `destructive` uses the danger token. Kept
// separate so a brand callout reads differently from a danger callout.
export type AlertVariant = 'info' | 'success' | 'warning' | 'destructive' | 'brand';

export interface AlertProps {
  variant?: AlertVariant;
  icon?: ReactNode;
  title?: ReactNode;
  children?: ReactNode;
  className?: string;
}

const VARIANT: Record<AlertVariant, string> = {
  info: 'border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200',
  success: 'border-green-200 bg-green-50 text-green-900 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-200',
  warning: 'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200',
  destructive: 'border-destructive/30 bg-destructive/10 text-destructive dark:text-red-200',
  brand: 'border-primary/30 bg-primary/10 text-primary dark:text-red-100',
};

/** Inline banner for contextual messages. */
export function Alert({ variant = 'info', icon, title, children, className }: AlertProps) {
  return (
    <div
      role="status"
      className={cn('flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm', VARIANT[variant], className)}
    >
      {icon && <span className="mt-0.5 flex-shrink-0">{icon}</span>}
      <div className="min-w-0">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={title ? 'mt-0.5' : undefined}>{children}</div>}
      </div>
    </div>
  );
}
