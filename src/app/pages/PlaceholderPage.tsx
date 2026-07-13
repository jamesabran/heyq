import { useParams } from 'react-router';
import { PageHeader } from '../components/layout/PageHeader';
import { Badge } from '../components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

interface PlaceholderPageProps {
  title: string;
  subtitle?: string;
  /** Milestone that will build out this screen (shown as a hint). */
  milestone?: string;
}

/**
 * Reusable placeholder for routes whose real screens land in later milestones.
 * Milestone 2 delivers the navigable shell + routing; content is intentionally
 * stubbed. Any route params are surfaced to prove routing resolves them.
 */
export function PlaceholderPage({ title, subtitle, milestone }: PlaceholderPageProps) {
  const params = useParams();
  const paramEntries = Object.entries(params).filter(([, v]) => v != null);

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={milestone ? <Badge variant="outline">{milestone}</Badge> : undefined}
      />
      <Card>
        <CardHeader>
          <CardTitle>Placeholder</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm text-muted-foreground">
          <p>
            This screen is scaffolded in Milestone 2 (navigable shell + routing). Its
            interactive content is built in a later milestone.
          </p>
          {paramEntries.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-foreground">Route params:</span>
              {paramEntries.map(([k, v]) => (
                <Badge key={k} variant="brand">
                  {k}: {v}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
