import { useTheme } from '../contexts/ThemeContext';
import { PageHeader } from '../components/layout/PageHeader';
import { Alert } from '../components/ui/Alert';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { FormField } from '../components/ui/FormField';
import { Input } from '../components/ui/Input';
import { Separator } from '../components/ui/Separator';

function Swatch({ name, token, className }: { name: string; token: string; className: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className={`h-14 rounded-lg border border-border ${className}`} />
      <div className="text-xs">
        <div className="font-medium text-foreground">{name}</div>
        <div className="text-muted-foreground">{token}</div>
      </div>
    </div>
  );
}

/**
 * Design-system validation page. Renders the vendored primitives in both the
 * QuadX brand and destructive treatments so brand-vs-danger distinctness and
 * light/dark theming can be verified by eye. Not a product screen.
 */
export function Validation() {
  const { theme } = useTheme();

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-8">
      <PageHeader
        title="Design System"
        subtitle="Milestone 1 validation surface — theming, tokens, and primitives."
        action={<Badge variant="brand">theme: {theme}</Badge>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Brand red vs destructive red</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">
            The QuadX brand red (<code>--primary</code>, scarlet <code>#E11900</code>) is
            intentionally distinct from the destructive red (<code>--destructive</code>,
            crimson <code>#D4183D</code>). They must never be confused for one another.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Swatch name="Brand / primary" token="--primary" className="bg-primary" />
            <Swatch name="Destructive" token="--destructive" className="bg-destructive" />
            <Swatch name="Background" token="--background" className="bg-background" />
            <Swatch name="Muted" token="--muted" className="bg-muted" />
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="default">Brand action</Button>
            <Button variant="destructive">Destructive action</Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Alert variant="brand" title="Brand alert">Uses the QuadX primary token.</Alert>
            <Alert variant="destructive" title="Destructive alert">Uses the danger token.</Alert>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Buttons</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button>Default</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="link">Link</Button>
          <Button variant="destructive">Destructive</Button>
          <Button disabled>Disabled</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Badges</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Badge>Default</Badge>
          <Badge variant="brand">Brand</Badge>
          <Badge variant="outline">Outline</Badge>
          <Badge variant="success">Success</Badge>
          <Badge variant="warning">Warning</Badge>
          <Badge variant="info">Info</Badge>
          <Badge variant="destructive">Destructive</Badge>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Form controls</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <FormField label="Subject" hint="A short summary of the request.">
            {(id) => <Input id={id} placeholder="e.g. Where is my order?" />}
          </FormField>
          <Separator />
          <FormField label="Email" error="Enter a valid email address.">
            {(id) => <Input id={id} type="email" defaultValue="not-an-email" aria-invalid />}
          </FormField>
        </CardContent>
      </Card>
    </div>
  );
}
