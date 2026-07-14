import type { CountBucket } from '../../services/reportsService';
import { cn } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';

/** A single KPI tile. */
export function StatTile({ label, value, tone }: { label: string; value: number; tone?: 'default' | 'danger' | 'warning' }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p
          className={cn(
            'mt-1 text-2xl font-bold',
            tone === 'danger' ? 'text-destructive' : tone === 'warning' ? 'text-amber-600 dark:text-amber-400' : 'text-foreground',
          )}
        >
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

/** Dependency-free horizontal bar chart from count buckets. */
export function BarList({ title, buckets }: { title: string; buckets: CountBucket[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="flex flex-col gap-2">
        {buckets.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data.</p>
        ) : (
          buckets.map((b) => (
            <div key={b.key} className="flex items-center gap-3 text-sm">
              <span className="w-32 shrink-0 truncate text-muted-foreground" title={b.label}>{b.label}</span>
              <div className="h-4 flex-1 overflow-hidden rounded bg-muted">
                <div className="h-full rounded bg-primary" style={{ width: `${(b.count / max) * 100}%` }} />
              </div>
              <span className="w-8 shrink-0 text-right font-medium text-foreground">{b.count}</span>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
