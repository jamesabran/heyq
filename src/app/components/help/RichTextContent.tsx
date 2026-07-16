import { useMemo, type MouseEvent } from 'react';
import { useNavigate } from 'react-router';
import { toRichText, withHeadingAnchors } from '../../lib/richText';
import { cn } from '../../lib/utils';

/**
 * Typography for KB rich text. Shared by the editor and every read surface so
 * an article looks identical while editing, in preview, and once published —
 * the acceptance criterion this constant exists to make structurally true,
 * rather than a pair of stylesheets someone has to keep in sync.
 *
 * The project has no Tailwind typography plugin, so element styles are declared
 * here as child selectors. `list-outside` plus per-level markers is what keeps
 * nested list numbering and bullets readable at depth.
 */
export const richTextClassName = cn(
  'text-sm leading-relaxed text-foreground',
  '[&>*+*]:mt-4',
  '[&_h2]:mt-6 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:text-foreground [&_h2]:scroll-mt-24',
  '[&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-foreground [&_h3]:scroll-mt-24',
  '[&_h4]:mt-4 [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-foreground [&_h4]:scroll-mt-24',
  '[&_p]:text-muted-foreground',
  '[&_strong]:font-semibold [&_strong]:text-foreground',
  '[&_em]:italic [&_u]:underline [&_s]:line-through',
  '[&_ul]:list-disc [&_ol]:list-decimal',
  '[&_ul]:list-outside [&_ol]:list-outside [&_ul]:pl-5 [&_ol]:pl-5',
  '[&_li]:text-muted-foreground [&_li]:pl-1 [&_li+li]:mt-1.5',
  // Nested lists sit closer to their parent item and change marker so depth reads.
  '[&_li>ul]:mt-1.5 [&_li>ol]:mt-1.5 [&_li>ul]:mb-1 [&_li>ol]:mb-1',
  '[&_ul_ul]:list-[circle] [&_ul_ul_ul]:list-[square]',
  '[&_ol_ol]:list-[lower-alpha] [&_ol_ol_ol]:list-[lower-roman]',
  '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-4',
  '[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-2 hover:[&_a]:text-primary/80',
);

export interface RichTextContentProps {
  /** Body in either the rich-text subset or the legacy convention. */
  body: string;
  /** Add anchor ids to headings so `#section` links resolve (legal documents). */
  withAnchors?: boolean;
  className?: string;
}

/**
 * Render a KB body. The body is sanitized here regardless of where it came
 * from — this is the last gate before markup reaches the DOM, so a body that
 * skipped the service (a preview of unsaved editor output, say) is still safe.
 */
export function RichTextContent({ body, withAnchors = false, className }: RichTextContentProps) {
  const navigate = useNavigate();
  const html = useMemo(
    () => (withAnchors ? withHeadingAnchors(body) : toRichText(body)),
    [body, withAnchors],
  );

  // Links are plain <a> elements inside the sanitized markup, so route them
  // through the router by hand — otherwise an internal KB link would trigger a
  // full page reload and lose app state.
  function onClick(event: MouseEvent<HTMLDivElement>) {
    const anchor = (event.target as HTMLElement).closest('a');
    if (!anchor) return;

    const href = anchor.getAttribute('href') ?? '';
    // Leave external links, anchor jumps, and modified clicks to the browser.
    if (!href.startsWith('/')) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

    event.preventDefault();
    navigate(href);
  }

  if (!html) {
    return <p className="text-sm text-muted-foreground">This article has no content yet.</p>;
  }

  return (
    <div
      className={cn(richTextClassName, className)}
      onClick={onClick}
      // Safe by construction: `html` is the output of the sanitizer above, which
      // drops scripts, event handlers, and unsafe URL schemes.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
