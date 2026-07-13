import { Link } from 'react-router';
import { PageHeader } from '../components/layout/PageHeader';
import { Alert } from '../components/ui/Alert';
import { buttonVariants } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';

/** Milestone-1 content placeholder for the application shell. */
export function Overview() {
  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <PageHeader
        title="HeyQ Foundation"
        subtitle="Milestone 1 — application shell, QuadX theme, and light/dark foundation."
        action={
          <Link to="/validation" className={buttonVariants({ variant: 'default' })}>
            Open design system
          </Link>
        }
      />

      <Alert variant="brand" title="Frontend-first prototype">
        This is the Milestone 1 foundation. Helpdesk features (help center, tickets,
        agent workspace, admin) are built in later milestones.
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle>What's wired up</CardTitle>
          <CardDescription>The pieces this foundation proves.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-inside list-disc space-y-1.5 text-sm text-muted-foreground">
            <li>Vite + React + TypeScript + Tailwind v4</li>
            <li>Local token pipeline generating light &amp; dark themes</li>
            <li>Provisional QuadX brand red, distinct from destructive red</li>
            <li>Persisted theme toggle and responsive shell</li>
            <li>Minimum vendored UI primitives</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
