import { IconEye, IconPencil } from '@tabler/icons-react';
import { cn } from '../../lib/utils';

export type EditorMode = 'edit' | 'preview';

const MODES: { value: EditorMode; label: string; icon: typeof IconPencil }[] = [
  { value: 'edit', label: 'Edit', icon: IconPencil },
  { value: 'preview', label: 'Preview', icon: IconEye },
];

/**
 * Edit/Preview switch for the article and legal editors. Preview renders the
 * unsaved working copy through the public renderer, so it answers "what will a
 * reader see" rather than "what was last saved".
 */
export function EditorModeTabs({ mode, onChange }: { mode: EditorMode; onChange: (mode: EditorMode) => void }) {
  return (
    <div role="tablist" aria-label="Editor view" className="flex gap-1 rounded-lg border border-border bg-muted/40 p-1">
      {MODES.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="tab"
          aria-selected={mode === value}
          onClick={() => onChange(value)}
          className={cn(
            'inline-flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            mode === value
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <Icon size={15} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
