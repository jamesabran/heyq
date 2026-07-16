import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IconArrowBackUp,
  IconArrowForwardUp,
  IconBold,
  IconClearFormatting,
  IconIndentDecrease,
  IconIndentIncrease,
  IconItalic,
  IconLink,
  IconList,
  IconListNumbers,
  IconUnderline,
  IconUnlink,
} from '@tabler/icons-react';
import type { KbLinkTarget } from '../../services/kbService';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { richTextClassName } from '../help/RichTextContent';

/**
 * RichTextEditor — the authoring surface for FAQ answers and legal documents.
 *
 * A `contentEditable` region driven by `document.execCommand`. execCommand is
 * deprecated but remains the only API every browser implements for native list
 * nesting, indentation, and an undo stack that understands them; a hand-rolled
 * model would have to reimplement all three. What it emits is messy (`<b>`,
 * `<div>`, inline styles), so nothing here is trusted: `lib/richText` sanitizes
 * on save and again on render.
 *
 * The editor is deliberately uncontrolled. Writing `value` back into the DOM on
 * every keystroke would collapse the selection to the start of the document on
 * each character, so the body is seeded once per document (`documentKey`) and
 * changes flow one way, out.
 */

export interface RichTextEditorProps {
  /** Initial body; re-seeded only when `documentKey` changes. */
  value: string;
  onChange: (html: string) => void;
  /** Identity of the document being edited — changing it re-seeds the editor. */
  documentKey: string;
  /** KB articles and legal documents offered by the internal-link picker. */
  linkTargets?: KbLinkTarget[];
  /** Id for the label association provided by FormField. */
  id?: string;
  ariaLabel?: string;
  className?: string;
}

type BlockFormat = 'p' | 'h2' | 'h3' | 'h4';

const BLOCK_LABELS: { value: BlockFormat; label: string }[] = [
  { value: 'p', label: 'Paragraph' },
  { value: 'h2', label: 'Heading' },
  { value: 'h3', label: 'Subheading' },
  { value: 'h4', label: 'Minor heading' },
];

export function RichTextEditor({
  value,
  onChange,
  documentKey,
  linkTargets = [],
  id,
  ariaLabel = 'Article body',
  className,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRange = useRef<Range | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');

  // Read `value` through a ref so the seeding effect always picks up the latest
  // body without taking `value` as a dependency.
  const valueRef = useRef(value);
  valueRef.current = value;

  // Seed the DOM once per document. `value` is intentionally not a dependency:
  // it changes on every keystroke, and re-seeding would fight the caret. Callers
  // roll `documentKey` when the stored body changes (after a save), which is the
  // one time re-seeding is wanted — it replaces the raw markup the browser
  // produced with the sanitized body that actually got stored.
  useEffect(() => {
    if (editorRef.current) editorRef.current.innerHTML = valueRef.current || '<p><br></p>';
    setLinkOpen(false);
  }, [documentKey]);

  const emit = useCallback(() => {
    if (editorRef.current) onChange(editorRef.current.innerHTML);
  }, [onChange]);

  const rememberSelection = useCallback(() => {
    const editor = editorRef.current;
    if (!editor) return;
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode)) {
      savedRange.current = selection.getRangeAt(0).cloneRange();
    }
  }, []);

  /** Run an execCommand against the editor, keeping focus and reporting the result. */
  const exec = useCallback(
    (command: string, argument?: string) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.focus();
      // Only fall back to the remembered range when the selection genuinely left
      // the editor (the link inputs take focus). Restoring it otherwise would
      // reinstate a range captured before the previous command mutated the DOM,
      // dragging the caret backwards and merging list items together.
      if (!selectionIsInside(editor)) restoreSelection(editor, savedRange.current);
      // jsdom has no execCommand; the toolbar still renders and stays testable.
      if (typeof document.execCommand === 'function') {
        // Emit tags, not inline styles. With styleWithCSS on (the default in
        // some engines) bold becomes `<span style="font-weight:bold">`, and the
        // sanitizer drops style attributes — so the formatting would silently
        // vanish on save. Tags survive.
        document.execCommand('styleWithCSS', false, 'false');
        document.execCommand(command, false, argument);
      }
      // The command moved the caret; the range captured before it is now stale.
      rememberSelection();
      emit();
    },
    [emit, rememberSelection],
  );

  const applyLink = useCallback(
    (href: string) => {
      const url = href.trim();
      if (!url) return;
      exec('createLink', url);
      setLinkOpen(false);
      setLinkUrl('');
    },
    [exec],
  );

  const faqTargets = linkTargets.filter((t) => t.group === 'FAQs');
  const legalTargets = linkTargets.filter((t) => t.group === 'TOS & Policies');

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border bg-background', className)}>
      <div
        role="toolbar"
        aria-label="Formatting"
        aria-controls={id}
        className="flex flex-wrap items-center gap-1 border-b border-border bg-muted/40 px-2 py-1.5"
        // Keep the caret in the document while the toolbar is used — a button
        // taking focus would blur the editor and drop the selection.
        onMouseDown={(e) => e.preventDefault()}
      >
        <Select
          aria-label="Text style"
          className="h-8 w-40 py-0 text-sm"
          value=""
          onChange={(e) => {
            const format = e.target.value as BlockFormat;
            if (format) exec('formatBlock', `<${format}>`);
            e.target.value = '';
          }}
        >
          <option value="">Text style…</option>
          {BLOCK_LABELS.map((b) => (
            <option key={b.value} value={b.value}>{b.label}</option>
          ))}
        </Select>

        <ToolbarDivider />
        <ToolbarButton label="Bold" icon={IconBold} onClick={() => exec('bold')} />
        <ToolbarButton label="Italic" icon={IconItalic} onClick={() => exec('italic')} />
        <ToolbarButton label="Underline" icon={IconUnderline} onClick={() => exec('underline')} />

        <ToolbarDivider />
        <ToolbarButton label="Bulleted list" icon={IconList} onClick={() => exec('insertUnorderedList')} />
        <ToolbarButton label="Numbered list" icon={IconListNumbers} onClick={() => exec('insertOrderedList')} />
        <ToolbarButton label="Decrease indent" icon={IconIndentDecrease} onClick={() => exec('outdent')} />
        <ToolbarButton label="Increase indent" icon={IconIndentIncrease} onClick={() => exec('indent')} />

        <ToolbarDivider />
        <ToolbarButton
          label="Insert link"
          icon={IconLink}
          pressed={linkOpen}
          onClick={() => {
            rememberSelection();
            setLinkOpen((open) => !open);
          }}
        />
        <ToolbarButton label="Remove link" icon={IconUnlink} onClick={() => exec('unlink')} />

        <ToolbarDivider />
        <ToolbarButton label="Undo" icon={IconArrowBackUp} onClick={() => exec('undo')} />
        <ToolbarButton label="Redo" icon={IconArrowForwardUp} onClick={() => exec('redo')} />
        <ToolbarButton
          label="Clear formatting"
          icon={IconClearFormatting}
          onClick={() => {
            exec('removeFormat');
            exec('formatBlock', '<p>');
          }}
        />
      </div>

      {linkOpen && (
        <div className="flex flex-wrap items-end gap-2 border-b border-border bg-muted/20 px-2 py-2">
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            External or custom URL
            <Input
              aria-label="Link URL"
              className="h-8 w-64 py-0 text-sm"
              placeholder="https://example.com or #section"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  applyLink(linkUrl);
                }
              }}
            />
          </label>
          <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
            Link to Knowledge Base
            <Select
              aria-label="Link to Knowledge Base"
              className="h-8 w-64 py-0 text-sm"
              value=""
              onChange={(e) => { if (e.target.value) applyLink(e.target.value); }}
            >
              <option value="">Choose an article or document…</option>
              {faqTargets.length > 0 && (
                <optgroup label="FAQs">
                  {faqTargets.map((t) => <option key={t.href} value={t.href}>{t.label}</option>)}
                </optgroup>
              )}
              {legalTargets.length > 0 && (
                <optgroup label="TOS & Policies">
                  {legalTargets.map((t) => <option key={t.href} value={t.href}>{t.label}</option>)}
                </optgroup>
              )}
            </Select>
          </label>
          <Button type="button" size="sm" onMouseDown={(e) => e.preventDefault()} onClick={() => applyLink(linkUrl)}>
            Apply link
          </Button>
          <p className="w-full text-xs text-muted-foreground">
            Select text first, then choose a destination. Append <code>#section-name</code> to a
            Knowledge Base link to point at a specific section.
          </p>
        </div>
      )}

      <div
        id={id}
        ref={editorRef}
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline="true"
        contentEditable
        suppressContentEditableWarning
        onInput={emit}
        onBlur={() => { rememberSelection(); emit(); }}
        onKeyUp={rememberSelection}
        onMouseUp={rememberSelection}
        className={cn(
          richTextClassName,
          'min-h-64 max-w-none px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
        )}
      />
    </div>
  );
}

/** True when the live selection sits inside the editor. */
function selectionIsInside(editor: HTMLElement): boolean {
  const selection = window.getSelection();
  return Boolean(selection && selection.rangeCount > 0 && editor.contains(selection.anchorNode));
}

function restoreSelection(editor: HTMLElement, range: Range | null): void {
  if (!range || !editor.contains(range.commonAncestorContainer)) return;
  const selection = window.getSelection();
  if (!selection) return;
  selection.removeAllRanges();
  selection.addRange(range);
}

interface ToolbarButtonProps {
  label: string;
  icon: typeof IconBold;
  onClick: () => void;
  pressed?: boolean;
}

function ToolbarButton({ label, icon: Icon, onClick, pressed }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'inline-flex h-8 w-8 items-center justify-center rounded-md text-foreground transition-colors',
        'hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        pressed && 'bg-accent text-primary',
      )}
    >
      <Icon size={16} />
    </button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden="true" className="mx-0.5 h-5 w-px bg-border" />;
}
