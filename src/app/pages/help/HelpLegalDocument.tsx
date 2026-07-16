import { useCallback, useMemo } from 'react';
import { Link, useParams } from 'react-router';
import { IconClock } from '@tabler/icons-react';
import { getLegalDocumentBySlug, listPublishedLegalDocuments } from '../../services/kbService';
import { useQuery } from '../../hooks/useQuery';
import { extractSections } from '../../lib/richText';
import { formatDate } from '../../lib/utils';
import { Badge } from '../../components/ui/Badge';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { Separator } from '../../components/ui/Separator';
import { RichTextContent } from '../../components/help/RichTextContent';
import { LegalTableOfContents } from '../../components/help/LegalTableOfContents';
import { BackToHelpLink, EmptyState, ErrorState, LoadingGrid } from '../../components/help/HelpStates';

/**
 * Public view of a single legal document. Headings are anchored so that both the
 * on-page contents list and cross-document `#section` links from other annexes
 * land on the right clause.
 */
export function HelpLegalDocument() {
  const { slug = '' } = useParams();

  const document = useQuery(useCallback(() => getLegalDocumentBySlug(slug), [slug]), [slug]);
  const doc = document.data;

  const related = useQuery(useCallback(() => listPublishedLegalDocuments(), []), []);
  const sections = useMemo(() => (doc ? extractSections(doc.body) : []), [doc]);

  if (document.error) return <ErrorState onRetry={document.refetch} />;
  if (document.loading) return <LoadingGrid count={3} />;

  if (!doc) {
    // Also the path for a draft slug — the service resolves it to null, so an
    // unpublished annex can never render publicly.
    return (
      <EmptyState title="Document not available" action={<BackToHelpLink />}>
        This document doesn&apos;t exist or isn&apos;t published yet.
      </EmptyState>
    );
  }

  const others = related.data?.filter((d) => d.id !== doc.id) ?? [];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Breadcrumb
        items={[
          { label: 'Help Center', to: '/help' },
          { label: 'TOS & Policies', to: '/help/legal' },
          { label: doc.title },
        ]}
      />

      <header className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-3xl font-bold text-foreground">{doc.title}</h1>
          {doc.kind === 'tos' && <Badge variant="outline">General Terms</Badge>}
        </div>
        <p className="text-muted-foreground">{doc.summary}</p>
        <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <IconClock size={15} aria-hidden="true" />
          Last updated {formatDate(doc.updatedAt)}
        </p>
      </header>

      {sections.length > 1 && <LegalTableOfContents sections={sections} />}

      <Separator />
      <RichTextContent body={doc.body} withAnchors />

      {others.length > 0 && (
        <>
          <Separator />
          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold text-foreground">Related documents</h2>
            <ul className="flex flex-col gap-1.5 text-sm">
              {others.map((d) => (
                <li key={d.id}>
                  <Link to={`/help/legal/${d.slug}`} className="text-primary underline underline-offset-2 hover:text-primary/80">
                    {d.title}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
