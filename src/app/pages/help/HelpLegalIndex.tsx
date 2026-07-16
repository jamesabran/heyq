import { useCallback } from 'react';
import { Link } from 'react-router';
import { IconClock, IconFileText, IconGavel } from '@tabler/icons-react';
import { listPublishedLegalDocuments } from '../../services/kbService';
import { useQuery } from '../../hooks/useQuery';
import { formatDate } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Card, CardContent } from '../../components/ui/Card';
import { EmptyState, ErrorState, LoadingGrid } from '../../components/help/HelpStates';

/**
 * Public index of TOS and policies. Lists published legal documents in the order
 * admins arranged them — the General TOS is not special-cased to the top, it is
 * simply where it was placed.
 */
export function HelpLegalIndex() {
  const documents = useQuery(useCallback(() => listPublishedLegalDocuments(), []), []);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Breadcrumb items={[{ label: 'Help Center', to: '/help' }, { label: 'TOS & Policies' }]} />

      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-foreground">Terms of Service & Policies</h1>
        <p className="text-muted-foreground">
          Our General Terms of Service and the annexes that form part of them. Each
          document is maintained separately and shows its own last-updated date.
        </p>
      </header>

      {documents.error ? (
        <ErrorState onRetry={documents.refetch} />
      ) : documents.loading ? (
        <LoadingGrid count={3} />
      ) : (documents.data?.length ?? 0) === 0 ? (
        <EmptyState title="No documents published">
          There are no published legal documents yet.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3">
          {documents.data?.map((doc) => (
            <li key={doc.id}>
              <Link to={`/help/legal/${doc.slug}`} className="group block focus-visible:outline-none">
                <Card className="transition-colors group-hover:border-primary/40 group-focus-visible:ring-2 group-focus-visible:ring-ring">
                  <CardContent className="flex items-start gap-3 p-4">
                    <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      {doc.kind === 'tos' ? <IconGavel size={19} /> : <IconFileText size={19} />}
                    </span>
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-semibold text-foreground group-hover:text-primary">{doc.title}</h2>
                        {doc.kind === 'tos' && <Badge variant="outline">General Terms</Badge>}
                      </div>
                      <p className="text-sm text-muted-foreground">{doc.summary}</p>
                      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <IconClock size={13} aria-hidden="true" />
                        Last updated {formatDate(doc.updatedAt)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
