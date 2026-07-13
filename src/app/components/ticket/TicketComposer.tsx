import { useState } from 'react';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';

type Mode = 'reply' | 'note';

/** Composer with a public-reply / internal-note toggle. */
export function TicketComposer({
  onSubmit,
  busy,
}: {
  onSubmit: (mode: Mode, body: string) => Promise<void> | void;
  busy?: boolean;
}) {
  const [mode, setMode] = useState<Mode>('reply');
  const [body, setBody] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    await onSubmit(mode, body.trim());
    setBody('');
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2">
      <div className="flex gap-1" role="tablist" aria-label="Composer mode">
        {(['reply', 'note'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
              mode === m ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent',
            )}
          >
            {m === 'reply' ? 'Public reply' : 'Internal note'}
          </button>
        ))}
      </div>
      <Textarea
        aria-label={mode === 'reply' ? 'Public reply' : 'Internal note'}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={mode === 'reply' ? 'Reply to the requester…' : 'Add an internal note (never shown to the requester)…'}
        className={mode === 'note' ? 'border-amber-300 dark:border-amber-500/40' : undefined}
      />
      <div className="flex justify-end">
        <Button type="submit" disabled={busy || !body.trim()}>
          {busy ? 'Saving…' : mode === 'reply' ? 'Send reply' : 'Add note'}
        </Button>
      </div>
    </form>
  );
}
