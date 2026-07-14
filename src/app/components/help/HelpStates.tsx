import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { IconAlertTriangle } from '@tabler/icons-react';
import { cn } from '../../lib/utils';
import { Button, buttonVariants } from '../ui/Button';
import { Card, CardContent } from '../ui/Card';

/** Simple skeleton grid shown while help content loads. */
export function LoadingGrid({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" aria-hidden="true">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="h-28 animate-pulse rounded-xl border border-border bg-muted" />
      ))}
    </div>
  );
}

/** Centered empty / not-found panel with an optional action. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        {children && <p className="max-w-md text-sm text-muted-foreground">{children}</p>}
        {action}
      </CardContent>
    </Card>
  );
}

/** Standard error panel with a retry action, for failed data loads. */
export function ErrorState({
  title = 'Something went wrong',
  message = 'We couldn’t load this right now. Please try again.',
  onRetry,
}: {
  title?: string;
  message?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 px-6 py-12 text-center">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <IconAlertTriangle size={22} />
        </span>
        <h2 className="text-lg font-semibold text-foreground">{title}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{message}</p>
        {onRetry && <Button variant="outline" onClick={onRetry}>Try again</Button>}
      </CardContent>
    </Card>
  );
}

/** Standard "back to help center" link, styled as a button. */
export function BackToHelpLink({ className }: { className?: string }) {
  return (
    <Link to="/help" className={cn(buttonVariants({ variant: 'outline' }), className)}>
      Back to Help Center
    </Link>
  );
}
