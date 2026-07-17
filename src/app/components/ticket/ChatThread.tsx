import { Fragment } from 'react';
import {
  IconAlertTriangle,
  IconDownload,
  IconHeadset,
  IconLock,
  IconPaperclip,
  IconRobot,
  IconUser,
} from '@tabler/icons-react';
import type { InternalNote, MockAttachment, TicketMessage } from '../../models/ticket';
import type { PendingReply } from '../../hooks/useTicketRealtime';
import { cn, formatDateTime } from '../../lib/utils';
import { formatBytes, isPreviewable } from '../../lib/attachmentPolicy';
import { ticketAttachmentUrl } from '../../services/ticketService';
import { Badge } from '../ui/Badge';

/**
 * The agent ticket conversation, as a professional support thread (not a casual
 * messenger): the REQUESTER sits on the left, AGENT replies on the right, SYSTEM
 * lines are centered and quiet, and INTERNAL NOTES are full-width amber cards that
 * can never be mistaken for a public reply. Consecutive messages from the same
 * sender are grouped under one header; attachments render beneath their message.
 *
 * It is a plain <ol> of items with real <time> elements and button-based retry, so
 * it stays keyboard-navigable and screen-reader friendly.
 */
type Item =
  | { kind: 'message'; at: string; key: string; data: TicketMessage }
  | { kind: 'note'; at: string; key: string; data: InternalNote }
  | { kind: 'pending'; at: string; key: string; data: PendingReply };

export function ChatThread({
  ticketId,
  messages,
  notes,
  pending,
  requesterName,
  onRetry,
}: {
  ticketId: string;
  messages: TicketMessage[];
  notes: InternalNote[];
  pending: PendingReply[];
  requesterName?: string;
  onRetry?: (tempId: string) => void;
}) {
  const items: Item[] = [
    ...messages.map((m): Item => ({ kind: 'message', at: m.createdAt, key: m.id, data: m })),
    ...notes.map((n): Item => ({ kind: 'note', at: n.createdAt, key: n.id, data: n })),
    ...pending.map((p): Item => ({ kind: 'pending', at: p.createdAt, key: p.tempId, data: p })),
  ].sort((a, b) => a.at.localeCompare(b.at) || a.key.localeCompare(b.key));

  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No messages yet.</p>;
  }

  return (
    <ol className="flex flex-col gap-1.5">
      {items.map((item, i) => {
        const startsGroup = i === 0 || senderKey(items[i - 1]) !== senderKey(item);
        return (
          <Fragment key={item.key}>
            {item.kind === 'message' && <MessageRow ticketId={ticketId} message={item.data} requesterName={requesterName} showHeader={startsGroup} />}
            {item.kind === 'note' && <NoteRow ticketId={ticketId} note={item.data} showHeader={startsGroup} />}
            {item.kind === 'pending' && <PendingRow pending={item.data} onRetry={onRetry} />}
          </Fragment>
        );
      })}
    </ol>
  );
}

function senderKey(item: Item): string {
  if (item.kind === 'note') return `note:${item.data.agentName}`;
  if (item.kind === 'pending') return `pending:${item.data.kind}`;
  const m = item.data;
  return m.authorType === 'system' ? 'system' : `${m.authorType}:${m.authorName}`;
}

// ── Public messages ──────────────────────────────────────────────────────────

function MessageRow({
  ticketId,
  message,
  requesterName,
  showHeader,
}: {
  ticketId: string;
  message: TicketMessage;
  requesterName?: string;
  showHeader: boolean;
}) {
  if (message.authorType === 'system') {
    return (
      <li className="my-1 flex justify-center">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
          <IconRobot size={13} aria-hidden="true" />
          {message.body}
          <time dateTime={message.createdAt} className="opacity-70">· {formatDateTime(message.createdAt)}</time>
        </span>
      </li>
    );
  }

  const isAgent = message.authorType === 'agent';
  const name = isAgent ? message.authorName : requesterName ?? message.authorName;
  const roleLabel = isAgent ? 'Agent' : 'Requester';
  const Icon = isAgent ? IconHeadset : IconUser;

  return (
    <li className={cn('flex', isAgent ? 'justify-end' : 'justify-start')}>
      <div className={cn('flex max-w-[85%] flex-col gap-1', isAgent ? 'items-end' : 'items-start')}>
        {showHeader && (
          <span className={cn('flex items-center gap-1.5 px-1 text-xs font-medium text-foreground', isAgent && 'flex-row-reverse')}>
            <Icon size={13} aria-hidden="true" />
            {name}
            <span className="font-normal text-muted-foreground">{roleLabel}</span>
          </span>
        )}
        <div
          className={cn(
            'rounded-2xl border px-3.5 py-2 text-sm',
            isAgent
              ? 'rounded-tr-sm border-primary/20 bg-primary/5 text-foreground'
              : 'rounded-tl-sm border-border bg-card text-foreground',
          )}
        >
          <p className="whitespace-pre-wrap">{message.body}</p>
          <Attachments ticketId={ticketId} attachments={message.attachments} />
        </div>
        <time dateTime={message.createdAt} className="px-1 text-[11px] text-muted-foreground">
          {formatDateTime(message.createdAt)}
          {message.channel === 'email' && ' · via email'}
        </time>
      </div>
    </li>
  );
}

// ── Internal notes (agent-only, full width, unmistakably distinct) ───────────

function NoteRow({ ticketId, note, showHeader }: { ticketId: string; note: InternalNote; showHeader: boolean }) {
  return (
    <li className="my-0.5">
      <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
        {showHeader && (
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-medium text-amber-900 dark:text-amber-200">
              <IconLock size={14} aria-hidden="true" /> {note.agentName}
              <Badge variant="warning">Internal note</Badge>
            </span>
            <time dateTime={note.createdAt} className="text-xs text-muted-foreground">{formatDateTime(note.createdAt)}</time>
          </div>
        )}
        <p className="whitespace-pre-wrap text-sm text-amber-900 dark:text-amber-100">{note.body}</p>
        <Attachments ticketId={ticketId} attachments={note.attachments} tone="note" />
      </div>
    </li>
  );
}

// ── Optimistic (pending / failed) agent sends ────────────────────────────────

function PendingRow({ pending, onRetry }: { pending: PendingReply; onRetry?: (tempId: string) => void }) {
  const failed = pending.status === 'failed';
  if (pending.kind === 'note') {
    return (
      <li className="my-0.5">
        <div className={cn('rounded-lg border border-amber-300 bg-amber-50 p-3 dark:border-amber-500/40 dark:bg-amber-500/10', !failed && 'opacity-70')}>
          <p className="whitespace-pre-wrap text-sm text-amber-900 dark:text-amber-100">{pending.body}</p>
          <PendingStatus pending={pending} onRetry={onRetry} />
        </div>
      </li>
    );
  }
  return (
    <li className="flex justify-end">
      <div className="flex max-w-[85%] flex-col items-end gap-1">
        <div className={cn('rounded-2xl rounded-tr-sm border border-primary/20 bg-primary/5 px-3.5 py-2 text-sm text-foreground', !failed && 'opacity-70')}>
          <p className="whitespace-pre-wrap">{pending.body}</p>
        </div>
        <PendingStatus pending={pending} onRetry={onRetry} />
      </div>
    </li>
  );
}

function PendingStatus({ pending, onRetry }: { pending: PendingReply; onRetry?: (tempId: string) => void }) {
  if (pending.status === 'sending') {
    return <span className="px-1 text-[11px] text-muted-foreground">Sending…</span>;
  }
  return (
    <span className="flex items-center gap-1.5 px-1 text-[11px] text-destructive">
      <IconAlertTriangle size={12} aria-hidden="true" /> Failed to send
      {onRetry && (
        <button type="button" onClick={() => onRetry(pending.tempId)} className="font-medium underline underline-offset-2 hover:no-underline">
          Retry
        </button>
      )}
    </span>
  );
}

// ── Attachments ──────────────────────────────────────────────────────────────

/**
 * Attachment chips. A REAL uploaded attachment (it has an `id`) is a download
 * link, with an inline thumbnail/preview for safely previewable images and PDFs;
 * anything else gets a download action. Legacy metadata-only attachments (no id —
 * older internal notes) render as static chips as before.
 */
function Attachments({ ticketId, attachments, tone }: { ticketId: string; attachments?: MockAttachment[]; tone?: 'note' }) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {attachments.map((a, i) => {
        const chip = cn(
          'inline-flex max-w-full items-center gap-1.5 rounded-md border px-2 py-1 text-xs',
          tone === 'note'
            ? 'border-amber-300 bg-amber-100/60 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100'
            : 'border-border bg-muted/50 text-foreground',
        );
        if (!a.id) {
          return (
            <li key={i} className={chip}>
              <IconPaperclip size={13} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{a.name}</span>
              <span className="text-muted-foreground">{formatBytes(a.size)}</span>
            </li>
          );
        }
        const previewable = isPreviewable(a.type);
        const isImage = a.type.startsWith('image/');
        return (
          <li key={a.id} className="flex flex-col gap-1">
            <a href={ticketAttachmentUrl(ticketId, a.id)} download={a.name} className={cn(chip, 'hover:bg-accent')}>
              <IconPaperclip size={13} aria-hidden="true" className="shrink-0" />
              <span className="truncate">{a.name}</span>
              <span className="text-muted-foreground">{formatBytes(a.size)}</span>
              <IconDownload size={13} aria-hidden="true" className="shrink-0" />
            </a>
            {previewable && (
              isImage ? (
                <a href={ticketAttachmentUrl(ticketId, a.id, true)} target="_blank" rel="noreferrer" className="block w-fit">
                  <img
                    src={ticketAttachmentUrl(ticketId, a.id, true)}
                    alt={a.name}
                    className="max-h-40 max-w-[220px] rounded-md border border-border object-contain"
                  />
                </a>
              ) : (
                <a href={ticketAttachmentUrl(ticketId, a.id, true)} target="_blank" rel="noreferrer" className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline">
                  Preview
                </a>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}
