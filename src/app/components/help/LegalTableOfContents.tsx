import type { RichTextSection } from '../../lib/richText';
import { cn } from '../../lib/utils';

/**
 * On-page contents for a legal document. Ids come from `extractSections`, which
 * derives them the same way `withHeadingAnchors` stamps them onto the rendered
 * headings — so every entry here has somewhere to land.
 */
export function LegalTableOfContents({ sections }: { sections: RichTextSection[] }) {
  return (
    <nav aria-label="On this page" className="rounded-xl border border-border bg-muted/30 px-4 py-3">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        On this page
      </h2>
      <ol className="mt-2 flex flex-col gap-1.5">
        {sections.map((section) => (
          <li
            key={section.id}
            className={cn(
              'text-sm',
              section.level === 3 && 'pl-4',
              section.level === 4 && 'pl-8',
            )}
          >
            <a
              href={`#${section.id}`}
              className="text-primary underline-offset-2 hover:underline"
            >
              {section.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
