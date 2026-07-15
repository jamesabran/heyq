import { forwardRef } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

// `brand` and `destructive` are deliberately different hues so a brand chip is
// never mistaken for a danger chip.
const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        outline: 'border border-border text-foreground',
        brand: 'bg-primary text-primary-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
        success: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-300',
        warning: 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300',
        info: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-300',
        'info-solid': 'bg-blue-600 text-white dark:bg-blue-500 dark:text-white',
        teal: 'bg-teal-100 text-teal-800 dark:bg-teal-500/20 dark:text-teal-300',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant, ...props }, ref) => (
    <div ref={ref} className={cn(badgeVariants({ variant }), className)} {...props} />
  ),
);
Badge.displayName = 'Badge';

export { badgeVariants };
