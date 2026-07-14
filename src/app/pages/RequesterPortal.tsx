import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import { resolveAccessToken } from '../services/requesterService';
import { addRequesterMessage, listMessages, reopenTicket } from '../services/ticketService';
import { useQuery } from '../hooks/useQuery';
import { useMutation } from '../hooks/useMutation';
import { STATUS_LABELS } from '../models/ticket';
import { formatDate } from '../lib/utils';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Separator } from '../components/ui/Separator';
import { Textarea } from '../components/ui/Textarea';
import { StatusChip } from '../components/ticket/StatusChip';
import { ConversationThread } from '../components/ticket/ConversationThread';
import { BackToHelpLink, EmptyState, ErrorState, LoadingGrid } from '../components/help/HelpStates';

/** Requester ticket portal, reached only via a simulated secure-link token. */
export function RequesterPortal() {
  const { token = '' } = useParams();
  const [version, setVersion] = useState(0);
  const [reply, setReply] = useState('');

  const portal = useQuery(useCallback(() => resolveAccessToken(token), [token]), [token, version]);
  const view = portal.data;

  const messages = useQuery(
    useCallback(() => (view ? listMessages(view.ticket.id) : Promise.resolve([])), [view]),
    [view?.ticket.id, version],
  );

  const sendReply = useMutation(addRequesterMessage);
  const reopen = useMutation(reopenTicket);
  const refresh = () => setVersion((v) => v + 1);

  if (portal.error) return <ErrorState onRetry={portal.refetch} />;
  if (portal.loading) return <LoadingGrid count={3} />;

  if (!view) {
    return (
      <EmptyState title="Ticket link not found" action={<BackToHelpLink />}>
        This ticket link is invalid or has expired. A ticket reference on its own
        doesn&apos;t open the portal — please use the secure link from your confirmation.
      </EmptyState>
    );
  }

  const { ticket, requester, teamName, categoryName, subcategoryName } = view;
  const canReopen = ticket.status === 'resolved' || ticket.status === 'closed';

  async function onSendReply(e: React.FormEvent) {
    e.preventDefault();
    if (!reply.trim() || !view) return;
    await sendReply.mutate(view.ticket.id, reply.trim());
    setReply('');
    refresh();
  }

  async function onReopen() {
    if (!view) return;
    await reopen.mutate(view.ticket.id);
    refresh();
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm text-muted-foreground">{ticket.reference}</span>
            <StatusChip status={ticket.status} holdReason={ticket.holdReason} />
          </div>
          <CardTitle className="text-2xl">{ticket.subject}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Detail label="Requester" value={requester.name} />
          <Detail label="Assigned team" value={teamName} />
          <Detail label="Concern" value={subcategoryName ? `${categoryName} · ${subcategoryName}` : categoryName} />
          <Detail label="Opened" value={formatDate(ticket.createdAt)} />
          <Detail label="Last updated" value={formatDate(ticket.updatedAt)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Conversation</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-4">
          <ConversationThread messages={messages.data ?? []} requesterName={requester.name} />

          <Separator />

          {canReopen ? (
            <div className="flex flex-col gap-2">
              <Alert variant="success">
                This ticket is {STATUS_LABELS[ticket.status].toLowerCase()}. Replying or reopening will bring it
                back to our team.
              </Alert>
              <div className="flex justify-end">
                <Button variant="outline" onClick={onReopen} disabled={reopen.loading}>
                  {reopen.loading ? 'Reopening…' : 'Reopen ticket'}
                </Button>
              </div>
            </div>
          ) : null}

          <form onSubmit={onSendReply} className="flex flex-col gap-2">
            <label htmlFor="reply" className="text-sm font-medium text-foreground">Add a reply</label>
            <Textarea id="reply" value={reply} onChange={(e) => setReply(e.target.value)}
              placeholder="Type your reply…" />
            <div className="flex justify-end">
              <Button type="submit" disabled={sendReply.loading || !reply.trim()}>
                {sendReply.loading ? 'Sending…' : 'Send reply'}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="font-medium text-foreground">{value}</dd>
    </div>
  );
}
