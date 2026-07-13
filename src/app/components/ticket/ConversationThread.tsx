import { IconRobot, IconUser, IconHeadset } from '@tabler/icons-react';
import type { MessageAuthorType, TicketMessage } from '../../models/ticket';
import { cn, formatDateTime } from '../../lib/utils';

// Renders the PUBLIC conversation only. Internal notes are a separate type and
// are never passed here, so requester-facing views can't leak them.
const AUTHOR_META: Record<MessageAuthorType, { label: string; icon: typeof IconUser; tone: string }> = {
  requester: { label: 'You', icon: IconUser, tone: 'border-border bg-card' },
  agent: { label: 'Support', icon: IconHeadset, tone: 'border-primary/20 bg-primary/5' },
  system: { label: 'System', icon: IconRobot, tone: 'border-border bg-muted' },
};

export function ConversationThread({
  messages,
  requesterName,
}: {
  messages: TicketMessage[];
  requesterName?: string;
}) {
  if (messages.length === 0) {
    return <p className="text-sm text-muted-foreground">No messages yet.</p>;
  }
  return (
    <ol className="flex flex-col gap-3">
      {messages.map((m) => {
        const meta = AUTHOR_META[m.authorType];
        const Icon = meta.icon;
        const who = m.authorType === 'requester' ? requesterName ?? meta.label : m.authorName || meta.label;
        return (
          <li key={m.id} className={cn('rounded-lg border p-3', meta.tone)}>
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Icon size={15} className="shrink-0" />
                {who}
                {m.channel === 'email' && (
                  <span className="text-xs font-normal text-muted-foreground">· via email</span>
                )}
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
