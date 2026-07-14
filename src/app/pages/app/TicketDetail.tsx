import { useCallback, useState } from 'react';
import { useParams } from 'react-router';
import {
  addAgentReply,
  addInternalNote,
  getTicketDetail,
  resolveTicket,
} from '../../services/ticketService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import { useIdentity } from '../../contexts/IdentityContext';
import {
  CONCERN_TYPE_LABELS,
  SOURCE_SYSTEM_LABELS,
  RESOLUTION_LABELS,
  type ResolutionType,
} from '../../models/ticket';
import { formatDate, formatDateTime } from '../../lib/utils';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Select } from '../../components/ui/Select';
import { Textarea } from '../../components/ui/Textarea';
import { Breadcrumb } from '../../components/ui/Breadcrumb';
import { StatusChip } from '../../components/ticket/StatusChip';
import { EscalationIndicator, PriorityBadge, SlaBadge } from '../../components/ticket/badges';
import { Badge } from '../../components/ui/Badge';
import { AgentConversation } from '../../components/ticket/AgentConversation';
import { TicketComposer } from '../../components/ticket/TicketComposer';
import { TicketActions } from '../../components/ticket/TicketActions';
import { TransactionPanel } from '../../components/ticket/TransactionPanel';
import { LinkedOrderPanel } from '../../components/ticket/LinkedOrderPanel';
import { EmptyState, ErrorState, LoadingGrid } from '../../components/help/HelpStates';

export function TicketDetail() {
  const { id = '' } = useParams();
  const { identity } = useIdentity();
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  const detail = useQuery(useCallback(() => getTicketDetail(id), [id]), [id, version]);
  const view = detail.data;

  const reply = useMutation(addAgentReply);
  const note = useMutation(addInternalNote);
  const resolve = useMutation(resolveTicket);

  const [resolution, setResolution] = useState<ResolutionType>('solved');
  const [resolveNote, setResolveNote] = useState('');

  if (detail.error) return <ErrorState onRetry={detail.refetch} />;
  if (detail.loading) return <LoadingGrid count={3} />;
  if (!view) {
    return <EmptyState title="Ticket not found">This ticket doesn&apos;t exist.</EmptyState>;
  }

  const { ticket, requester, teamName, categoryName, subcategoryName, assigneeName, messages, notes, timeline, sla } = view;
  const busy = reply.loading || note.loading;
  const isClosedish = ticket.status === 'resolved' || ticket.status === 'closed';

  async function onCompose(mode: 'reply' | 'note', body: string) {
    if (mode === 'reply') await reply.mutate(id, identity.id, body);
    else await note.mutate(id, identity.id, body);
    refresh();
  }

  async function onResolve() {
    await resolve.mutate(id, identity.id, resolution, resolveNote.trim() || undefined);
    setResolveNote('');
    refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumb items={[{ label: 'My Queue', to: '/app/mine' }, { label: ticket.reference }]} />
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{ticket.subject}</h1>
          <p className="text-sm text-muted-foreground">{ticket.reference}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Reopened is a flag, so it sits beside the status rather than replacing it. */}
          {ticket.reopenedAt && (
            <Badge variant="outline" title={`Reopened ${formatDate(ticket.reopenedAt)}`}>Reopened</Badge>
          )}
          <EscalationIndicator state={ticket.escalationState} />
          <StatusChip status={ticket.status} holdReason={ticket.holdReason} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)_260px]">
        {/* Left: context */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Requester</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-foreground">{requester.name}</span>
              <span className="text-muted-foreground">{requester.email}</span>
              {requester.mobile && <span className="text-muted-foreground">{requester.mobile}</span>}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Classification</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <Row label="Concern" value={subcategoryName ? `${categoryName} · ${subcategoryName}` : categoryName} />
              <Row label="Concern type" value={ticket.concernType ? CONCERN_TYPE_LABELS[ticket.concernType] : 'Unset'} />
              <Row label="Team" value={teamName} />
              <Row label="Assignee" value={assigneeName ?? 'Unassigned'} />
              <Row label="Tier" value={ticket.supportTier} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Priority</span>
                <PriorityBadge priority={ticket.priority} />
              </div>
              <Row label="Escalation" value={ticket.escalationState === 'none' ? 'Not escalated' : ticket.escalationState.replace(/_/g, ' ')} />
              <Row label="Source" value={ticket.source} />
              {ticket.sourceSystem && (
                <Row label="Source system" value={SOURCE_SYSTEM_LABELS[ticket.sourceSystem]} />
              )}
              {ticket.source === 'internal' && (
                <Row
                  label="Requester notifications"
                  value={ticket.requesterNotificationsEnabled ? 'Enabled' : 'Off'}
                />
              )}
            </CardContent>
          </Card>

          {/* Business+ linked order (M22) — snapshot-first order context. */}
          {ticket.linkedOrder && <LinkedOrderPanel order={ticket.linkedOrder} />}

          <TransactionPanel
            ticketId={ticket.id}
            relatedTransactionId={ticket.relatedTransactionId}
            viewerTeamId={identity.teamId}
            onChanged={refresh}
          />

          <Card>
            <CardHeader><CardTitle>SLA</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">First response</span>
                <SlaBadge target={sla.firstResponse} />
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Resolution</span>
                <SlaBadge target={sla.resolution} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
            <CardContent>
              <ol className="flex flex-col gap-3">
                {timeline.map((e) => (
                  <li key={e.id} className="text-sm">
                    <p className="text-foreground">{e.summary}</p>
                    <p className="text-xs text-muted-foreground">{e.actor} · {formatDateTime(e.timestamp)}</p>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </div>

        {/* Center: conversation */}
        <Card>
          <CardHeader><CardTitle>Conversation</CardTitle></CardHeader>
          <CardContent className="flex flex-col gap-4">
            <AgentConversation messages={messages} notes={notes} />
            <TicketComposer onSubmit={onCompose} busy={busy} />
          </CardContent>
        </Card>

        {/* Right: actions */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Resolve</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              {isClosedish ? (
                <Alert variant="success">
                  This ticket is {ticket.status}
                  {ticket.resolutionType ? ` (${RESOLUTION_LABELS[ticket.resolutionType as ResolutionType] ?? ticket.resolutionType})` : ''}.
                </Alert>
              ) : (
                <>
                  <Select aria-label="Resolution type" value={resolution} onChange={(e) => setResolution(e.target.value as ResolutionType)}>
                    {Object.entries(RESOLUTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </Select>
                  <Textarea aria-label="Resolution note" value={resolveNote} onChange={(e) => setResolveNote(e.target.value)} placeholder="Resolution note (optional)…" className="min-h-16" />
                  <Button onClick={onResolve} disabled={resolve.loading}>
                    {resolve.loading ? 'Resolving…' : 'Resolve ticket'}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          <TicketActions view={view} agentId={identity.id} onChanged={refresh} />

          <p className="px-1 text-xs text-muted-foreground">Opened {formatDate(ticket.createdAt)}</p>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium capitalize text-foreground">{value}</span>
    </div>
  );
}
