import { useCallback, useState } from 'react';
import { Link } from 'react-router';
import { IconMail } from '@tabler/icons-react';
import {
  getMutedEvents,
  listForRecipient,
  markAllRead,
  markRead,
  setEventMuted,
} from '../../services/notificationService';
import { useQuery } from '../../hooks/useQuery';
import { useIdentity } from '../../contexts/IdentityContext';
import { NOTIFICATION_EVENT_LABELS } from '../../models/notification';
import { cn, formatDateTime } from '../../lib/utils';
import { PageHeader } from '../../components/layout/PageHeader';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent } from '../../components/ui/Card';
import { ErrorState, LoadingGrid } from '../../components/help/HelpStates';

export function NotificationsPage() {
  const { identity } = useIdentity();
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  const feed = useQuery(useCallback(() => listForRecipient(identity.id), [identity.id]), [identity.id, version]);
  const muted = useQuery(useCallback(() => getMutedEvents(), []), [version]);
  const resolvedMuted = muted.data?.includes('ticket_resolved') ?? false;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <PageHeader
        title="Notifications"
        subtitle="Simulated in-app feed for your account."
        action={
          <Button variant="outline" size="sm" onClick={async () => { await markAllRead(identity.id); refresh(); }}>
            Mark all read
          </Button>
        }
      />

      <label className="flex items-center gap-2 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={resolvedMuted}
          onChange={async (e) => { await setEventMuted('ticket_resolved', e.target.checked); refresh(); }}
        />
        Mute “ticket resolved” notifications
      </label>

      {feed.error ? (
        <ErrorState onRetry={feed.refetch} />
      ) : feed.loading ? (
        <LoadingGrid count={2} />
      ) : (feed.data?.length ?? 0) === 0 ? (
        <Card><CardContent className="px-6 py-10 text-center text-sm text-muted-foreground">No notifications.</CardContent></Card>
      ) : (
        <ol className="flex flex-col gap-2">
          {feed.data?.map((n) => (
            <li
              key={n.id}
              className={cn('flex items-start justify-between gap-3 rounded-lg border border-border p-3', !n.read && 'bg-primary/5')}
            >
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-label="unread" />}
                  <span className="font-medium text-foreground">{n.title}</span>
                  {n.emailed && (
                    <Badge variant="info"><IconMail size={12} className="mr-1 inline" />Email sent</Badge>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">
                  {NOTIFICATION_EVENT_LABELS[n.event]} · {formatDateTime(n.createdAt)}
                  {n.ticketId && (
                    <> · <Link to={`/app/tickets/${n.ticketId}`} className="text-primary hover:underline">{n.ticketRef}</Link></>
                  )}
                </span>
              </div>
              {!n.read && (
                <Button size="sm" variant="ghost" onClick={async () => { await markRead(n.id); refresh(); }}>Mark read</Button>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
