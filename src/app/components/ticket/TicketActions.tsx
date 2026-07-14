import { useCallback, useState } from 'react';
import { listAgents, listCategories, listTeams } from '../../services/catalogService';
import {
  assignTicket,
  claimTicket,
  deescalateTicket,
  escalateTicket,
  holdTicket,
  reclassifyTicket,
  resumeTicket,
} from '../../services/ticketService';
import { useQuery } from '../../hooks/useQuery';
import { useMutation } from '../../hooks/useMutation';
import {
  CONCERN_TYPES,
  CONCERN_TYPE_LABELS,
  ESCALATION_REASON_LABELS,
  HOLD_REASONS,
  HOLD_REASON_LABELS,
  type ConcernType,
  type EscalationReason,
  type HoldReason,
  type TicketDetailView,
  type TicketPriority,
} from '../../models/ticket';
import { Alert } from '../ui/Alert';
import { Button } from '../ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';

const PRIORITIES: TicketPriority[] = ['normal', 'high', 'urgent'];
const PRIORITY_LABELS: Record<TicketPriority, string> = { normal: 'Normal', high: 'High', urgent: 'Urgent' };

/** Assignment, classification, and escalation controls for the detail right pane. */
export function TicketActions({
  view,
  agentId,
  onChanged,
}: {
  view: TicketDetailView;
  agentId: string;
  onChanged: () => void;
}) {
  const { ticket } = view;
  const teams = useQuery(useCallback(() => listTeams(), []), []);
  const agents = useQuery(useCallback(() => listAgents(), []), []);
  const categories = useQuery(useCallback(() => listCategories(), []), []);

  const claim = useMutation(claimTicket);
  const assign = useMutation(assignTicket);
  const reclassify = useMutation(reclassifyTicket);
  const escalate = useMutation(escalateTicket);
  const deescalate = useMutation(deescalateTicket);
  const hold = useMutation(holdTicket);
  const resume = useMutation(resumeTicket);

  const [assignee, setAssignee] = useState(ticket.assigneeId ?? '');
  const [categoryId, setCategoryId] = useState(ticket.categoryId);
  const [subcategoryId, setSubcategoryId] = useState(ticket.subcategoryId ?? '');
  const [concernType, setConcernType] = useState<ConcernType | ''>(ticket.concernType ?? '');
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority);
  const [reroute, setReroute] = useState(true);

  const [holdReason, setHoldReason] = useState<HoldReason>(ticket.holdReason ?? 'waiting_requester');
  const [reason, setReason] = useState<EscalationReason>('needs_specialist');
  const [escNote, setEscNote] = useState('');
  const [escTeam, setEscTeam] = useState(ticket.teamId);
  const [deNote, setDeNote] = useState('');

  const subcategories = categories.data?.find((c) => c.id === categoryId)?.subcategories ?? [];
  const isEscalated = ticket.escalationState === 'escalated';

  const after = async (p: Promise<unknown>) => { await p; onChanged(); };

  return (
    <div className="flex flex-col gap-4">
      {/* Assignment */}
      <Card>
        <CardHeader><CardTitle>Assignment</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <p className="text-muted-foreground">
            Current: <span className="font-medium text-foreground">{view.assigneeName ?? 'Unassigned'}</span>
          </p>
          {ticket.assigneeId !== agentId && (
            <Button size="sm" variant="secondary" onClick={() => after(claim.mutate(ticket.id, agentId))} disabled={claim.loading}>
              Claim
            </Button>
          )}
          <Select aria-label="Reassign to" value={assignee} onChange={(e) => setAssignee(e.target.value)}>
            <option value="">Unassigned</option>
            {agents.data?.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </Select>
          <Button size="sm" variant="outline" onClick={() => after(assign.mutate(ticket.id, agentId, assignee || undefined))} disabled={assign.loading}>
            Update assignee
          </Button>
        </CardContent>
      </Card>

      {/* Classification */}
      <Card>
        <CardHeader><CardTitle>Classification</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <Select aria-label="Category" value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setSubcategoryId(''); }}>
            {categories.data?.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          {subcategories.length > 0 && (
            <Select aria-label="Subcategory" value={subcategoryId} onChange={(e) => setSubcategoryId(e.target.value)}>
              <option value="">— No subcategory —</option>
              {subcategories.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </Select>
          )}
          {/* Concern Type — a SEPARATE field from category/subcategory (rule #16). */}
          <Select aria-label="Concern type" value={concernType} onChange={(e) => setConcernType(e.target.value as ConcernType | '')}>
            <option value="">— No concern type —</option>
            {CONCERN_TYPES.map((c) => <option key={c} value={c}>{CONCERN_TYPE_LABELS[c]}</option>)}
          </Select>
          <Select aria-label="Priority" value={priority} onChange={(e) => setPriority(e.target.value as TicketPriority)}>
            {PRIORITIES.map((p) => <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>)}
          </Select>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" checked={reroute} onChange={(e) => setReroute(e.target.checked)} />
            Re-route team when the category changes
          </label>
          <Button
            size="sm"
            variant="outline"
            disabled={reclassify.loading}
            onClick={() => after(reclassify.mutate(ticket.id, agentId, { categoryId, subcategoryId, concernType: concernType || undefined, priority, reroute }))}
          >
            Update classification
          </Button>
        </CardContent>
      </Card>

      {/* On hold — a status with a reason, replacing the old Pending Requester
          status. The reason is what makes the hold actionable later. */}
      <Card>
        <CardHeader><CardTitle>Hold</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {ticket.status === 'on_hold' ? (
            <>
              <Alert variant="warning">
                On hold — {HOLD_REASON_LABELS[ticket.holdReason ?? 'other']}. The resolution clock is paused
                only while we are blocked by someone outside the team.
              </Alert>
              <Button size="sm" variant="outline" disabled={resume.loading} onClick={() => after(resume.mutate(ticket.id, agentId))}>
                Resume work
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Blocked on someone else? Put it on hold and say who.</p>
              <Select aria-label="Hold reason" value={holdReason} onChange={(e) => setHoldReason(e.target.value as HoldReason)}>
                {HOLD_REASONS.map((r) => <option key={r} value={r}>{HOLD_REASON_LABELS[r]}</option>)}
              </Select>
              <Button size="sm" variant="outline" disabled={hold.loading} onClick={() => after(hold.mutate(ticket.id, agentId, holdReason))}>
                Put on hold
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* Escalation */}
      <Card>
        <CardHeader><CardTitle>Escalation</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {isEscalated ? (
            <>
              <Alert variant="warning">Escalated to L2. Workflow status is unchanged.</Alert>
              <Textarea aria-label="De-escalation note" value={deNote} onChange={(e) => setDeNote(e.target.value)} placeholder="Reason for returning to L1…" className="min-h-16" />
              <Button size="sm" variant="outline" disabled={deescalate.loading} onClick={() => after(deescalate.mutate(ticket.id, agentId, deNote))}>
                Return to L1
              </Button>
            </>
          ) : (
            <>
              <p className="text-xs text-muted-foreground">Escalation changes tier/team/owner — not the workflow status.</p>
              <Select aria-label="Escalation reason" value={reason} onChange={(e) => setReason(e.target.value as EscalationReason)}>
                {Object.entries(ESCALATION_REASON_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
              <Select aria-label="Escalate to team" value={escTeam} onChange={(e) => setEscTeam(e.target.value)}>
                {teams.data?.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </Select>
              <Textarea aria-label="Escalation note" value={escNote} onChange={(e) => setEscNote(e.target.value)} placeholder="Required: why is this being escalated?" className="min-h-16" />
              <Button
                size="sm"
                disabled={escalate.loading || !escNote.trim()}
                onClick={() => after(escalate.mutate(ticket.id, agentId, { reason, note: escNote, toTeamId: escTeam }))}
              >
                Escalate to L2
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
