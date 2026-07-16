import { useEffect, useRef, useState } from 'react';
import type { MockAttachment } from '../../models/ticket';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Textarea } from '../ui/Textarea';
import { AttachmentPicker } from './AttachmentPicker';

type Mode = 'reply' | 'note';

/**
 * Composer with a public-reply / internal-note toggle, attachment metadata, and
 * live typing signals. `onTyping('start')` fires as the agent types (the caller
 * throttles it); `onTyping('stop')` fires on send, on clearing the input, on
 * blur, and on unmount (navigation away) — so a typing indicator can never strand.
 */
export function TicketComposer({
  onSubmit,
  onTyping,
  busy,
}: {
  onSubmit: (mode: Mode, body: string, attachments?: MockAttachment[]) => Promise<void> | void;
  onTyping?: (state: 'start' | 'stop') => void;
  busy?: boolean;
}) {
  const [mode, setMode] = useState<Mode>('reply');
  const [body, setBody] = useState('');
  const [attachments, setAttachments] = useState<MockAttachment[]>([]);

  // Always stop typing when the composer unmounts (navigation away / ticket switch).
  const typingRef = useRef(onTyping);
  typingRef.current = onTyping;
  useEffect(() => () => typingRef.current?.('stop'), []);

  function onBodyChange(value: string) {
    setBody(value);
    onTyping?.(value.trim() ? 'start' : 'stop');
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    onTyping?.('stop');
    await onSubmit(mode, body.trim(), attachments.length ? attachments : undefined);
    setBody('');
    setAttachments([]);
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
        onChange={(e) => onBodyChange(e.target.value)}
        onBlur={() => onTyping?.('stop')}
        placeholder={mode === 'reply' ? 'Reply to the requester…' : 'Add an internal note (never shown to the requester)…'}
        className={mode === 'note' ? 'border-amber-300 dark:border-amber-500/40' : undefined}
      />
      <AttachmentPicker value={attachments} onChange={setAttachments} />
      <div className="flex justify-end">
        <Button type="submit" disabled={busy || !body.trim()}>
          {busy ? 'Saving…' : mode === 'reply' ? 'Send reply' : 'Add note'}
        </Button>
      </div>
    </form>
  );
}
