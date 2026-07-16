import {
  CONCERN_TYPE_LABELS,
  RESOLUTION_LABELS,
  SOURCE_SYSTEM_LABELS,
  type ResolutionType,
  type TicketDetailView,
} from '../../models/ticket';
import { formatDate, formatDateTime } from '../../lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { CollapsibleSection } from '../ui/CollapsibleSection';
import { ChatThread } from '../ticket/ChatThread';
import { LinkedOrderPanel } from '../ticket/LinkedOrderPanel';
import { TransactionPanel } from '../ticket/TransactionPanel';
import { StatusChip } from '../ticket/StatusChip';
import { ConcernTypeBadge, EscalationIndicator, PriorityBadge, SlaBadge } from '../ticket/badges';
import type { PendingReply } from '../../hooks/useTicketRealtime';

// Review evidence is read-only: there are never optimistic sends to render.
const NO_PENDING: PendingReply[] = [];

/**
 * Read-only ticket evidence for the review workspace. The conversation is the
 * PRIMARY content; everything else is condensed into a compact summary and folded
 * into collapsible sections. There are deliberately NO handling controls here —
 * no reply, assignment, classification, hold, or resolution — reviewing a ticket
 * must never change how it was handled.
 */
export function EvidencePane({
  evidence,
  agentName,
}: {
  evidence: TicketDetailView;
  agentName: string;
}) {
  const { ticket, requester, teamName, categoryName, subcategoryName, messages, notes, timeline, sla } = evidence;
  const isClosedish = ticket.status === 'resolved' || ticket.status === 'closed';
  const hasTransaction = Boolean(ticket.linkedOrder || ticket.relatedTransactionId);

  return (
    <div className="flex flex-col gap-4">
      {/* Compact metadata summary. */}
      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">{ticket.reference}</span>
            <StatusChip status={ticket.status} holdReason={ticket.holdReason} />
            <EscalationIndicator state={ticket.escalationState} />
            {ticket.reopenedAt && <Badge variant="outline">Reopened</Badge>}
          </div>
          <h2 className="text-lg font-semibold text-foreground">{ticket.subject}</h2>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
            <span>Agent: <span className="font-medium text-foreground">{agentName}</span></span>
            <span>Team: <span className="font-medium text-foreground">{teamName}</span></span>
            <span className="inline-flex items-center gap-1.5">Concern: <ConcernTypeBadge concernType={ticket.concernType} /></span>
            <span className="inline-flex items-center gap-1.5">Priority: <PriorityBadge priority={ticket.priority} /></span>
          </div>
        </CardContent>
      </Card>

      {/* Primary content — the conversation (with interleaved internal notes). */}
      <Card>
        <CardHeader><CardTitle>Conversation</CardTitle></CardHeader>
        <CardContent>
          {/* Same zigzag thread as ticket-detail — requester left, agent right,
              system centered, internal notes distinct. Read-only here: no pending
              sends and no retry, so the review can never alter the handling. */}
          <ChatThread messages={messages} notes={notes} pending={NO_PENDING} requesterName={requester.name} />
        </CardContent>
      </Card>

      {/* Secondary details, folded. */}
      <CollapsibleSection title="Ticket details">
        <dl className="flex flex-col gap-2 text-sm">
          <Row label="Requester" value={`${requester.name}${requester.email ? ` · ${requester.email}` : ''}`} />
          <Row label="Concern" value={subcategoryName ? `${categoryName} · ${subcategoryName}` : categoryName} />
          <Row label="Concern type" value={ticket.concernType ? CONCERN_TYPE_LABELS[ticket.concernType] : 'Unset'} />
          <Row label="Team" value={teamName} />
          <Row label="Agent" value={agentName} />
          <Row label="Tier" value={ticket.supportTier} />
          <Row label="Escalation" value={ticket.escalationState === 'none' ? 'Not escalated' : ticket.escalationState.replace(/_/g, ' ')} />
          <Row label="Source" value={ticket.source} />
          {ticket.sourceSystem && <Row label="Source system" value={SOURCE_SYSTEM_LABELS[ticket.sourceSystem]} />}
          <Row label="Opened" value={formatDate(ticket.createdAt)} />
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">First response SLA</span>
            <SlaBadge target={sla.firstResponse} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Resolution SLA</span>
            <SlaBadge target={sla.resolution} />
          </div>
        </dl>
      </CollapsibleSection>

      {hasTransaction && (
        <CollapsibleSection title="Linked order & transaction">
          <div className="flex flex-col gap-4">
            {ticket.linkedOrder && <LinkedOrderPanel order={ticket.linkedOrder} />}
            {ticket.relatedTransactionId && (
              // Read-only: the ticket already has a linked transaction, so the panel
              // renders details only — no linking controls are reachable here.
              <TransactionPanel
                ticketId={ticket.id}
                relatedTransactionId={ticket.relatedTransactionId}
                viewerTeamId={undefined}
                onChanged={() => {}}
              />
            )}
          </div>
        </CollapsibleSection>
      )}

      <CollapsibleSection title="Timeline & escalation history" meta={`${timeline.length} events`}>
        {timeline.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded.</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {timeline.map((e) => (
              <li key={e.id} className="text-sm">
                <p className="text-foreground">{e.summary}</p>
                <p className="text-xs text-muted-foreground">{e.actor} · {formatDateTime(e.timestamp)}</p>
              </li>
            ))}
          </ol>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Resolution">
        {isClosedish ? (
          <div className="flex flex-col gap-1 text-sm">
            <Row
              label="Outcome"
              value={ticket.resolutionType ? (RESOLUTION_LABELS[ticket.resolutionType as ResolutionType] ?? ticket.resolutionType) : `Marked ${ticket.status}`}
            />
            {ticket.resolvedAt && <Row label="Resolved" value={formatDateTime(ticket.resolvedAt)} />}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">This ticket is not resolved yet.</p>
        )}
      </CollapsibleSection>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium capitalize text-foreground">{value}</span>
    </div>
  );
}
