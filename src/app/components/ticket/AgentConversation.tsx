import { IconLock, IconRobot, IconUser, IconHeadset } from '@tabler/icons-react';
import type { InternalNote, TicketMessage } from '../../models/ticket';
import { cn, formatDateTime } from '../../lib/utils';
import { Badge } from '../ui/Badge';

type Entry =
  | { kind: 'message'; at: string; data: TicketMessage }
  | { kind: 'note'; at: string; data: InternalNote };

// Agent-side conversation: public messages interleaved with INTERNAL NOTES.
// Notes are tinted + badged and are a distinct entity — this view is never
// rendered to requesters (docs/product-rules.md #5).
export function AgentConversation({
  messages,
  notes,
}: {
  messages: TicketMessage[];
  notes: InternalNote[];
}) {
  const entries: Entry[] = [
    ...messages.map((m): Entry => ({ kind: 'message', at: m.createdAt, data: m })),
    ...notes.map((n): Entry => ({ kind: 'note', at: n.createdAt, data: n })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-3">
      {entries.map((entry) => {
        if (entry.kind === 'note') {
          const n = entry.data;
          return (
            <li key={n.id} className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
              <div className="mb-1 flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-200">
                  <IconLock size={14} /> {n.agentName}
                  <Badge variant="warning">Internal note</Badge>
                </span>
                <time className="text-xs text-muted-foreground">{formatDateTime(n.createdAt)}</time>
              </div>
              <p className="whitespace-pre-wrap text-sm text-amber-900 dark:text-amber-100">{n.body}</p>
            </li>
          );
        }
        const m = entry.data;
        const isAgent = m.authorType === 'agent';
        const Icon = m.authorType === 'system' ? IconRobot : isAgent ? IconHeadset : IconUser;
        return (
          <li key={m.id} className={cn('rounded-lg border p-3', isAgent ? 'border-primary/20 bg-primary/5' : 'border-border bg-card')}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Icon size={14} /> {m.authorName}
                <span className="text-xs font-normal text-muted-foreground">
                  {m.authorType === 'requester' ? 'Requester' : m.authorType === 'system' ? 'System' : 'Agent'}
                </span>
              </span>
              <time className="text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</time>
            </div>
            <p className="whitespace-pre-wrap text-sm text-foreground">{m.body}</p>
          </li>
        );
      })}
    </ol>
  );
}
