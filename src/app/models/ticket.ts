// Typed ticket contracts (docs/mock-data-model.md). Status and escalationState
// are INDEPENDENT fields — a ticket can be in_progress while escalated
// (docs/product-rules.md #2). Classification fields stay separate (#1).

export type TicketStatus =
  | 'new'
  | 'open'
  | 'in_progress'
  | 'pending_requester'
  | 'resolved'
  | 'closed'
  | 'reopened';

export type EscalationState = 'none' | 'escalated' | 'returned_to_l1';
export type SupportTier = 'L1' | 'L2';
export type TicketSource = 'web' | 'email' | 'transaction' | 'api';
export type TicketPriority = 'low' | 'normal' | 'high' | 'urgent';
export type MessageAuthorType = 'requester' | 'agent' | 'system';

export interface Requester {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  isGuest: boolean;
  linkedCustomerId?: string;
  brandId: string;
}

export interface Ticket {
  id: string;
  reference: string;
  brandId: string;
  requesterId: string;
  subject: string;
  description: string;
  categoryId: string;
  subcategoryId?: string;
  status: TicketStatus;
  escalationState: EscalationState;
  supportTier: SupportTier;
  teamId: string;
  priority: TicketPriority;
  severity?: string;
  resolutionType?: string;
  source: TicketSource;
  assigneeId?: string;
  relatedTransactionId?: string;
  slaPolicyId: string;
  createdAt: string;
  updatedAt: string;
  firstResponseAt?: string;
  resolvedAt?: string;
  escalatedAt?: string;
}

// Internal note — a SEPARATE type from TicketMessage so it can never be passed to
// a requester-facing view. Agent-only (docs/product-rules.md #5).
export interface InternalNote {
  id: string;
  ticketId: string;
  agentId: string;
  agentName: string;
  body: string;
  createdAt: string;
}

// Public conversation entry. Internal notes are a SEPARATE type and are never
// rendered to requesters (docs/product-rules.md #5).
export interface TicketMessage {
  id: string;
  ticketId: string;
  authorType: MessageAuthorType;
  authorId: string;
  authorName: string;
  body: string;
  channel: 'web' | 'email';
  visibility: 'public';
  createdAt: string;
}

export interface StatusEvent {
  id: string;
  ticketId: string;
  actor: string;
  fromStatus?: TicketStatus;
  toStatus: TicketStatus;
  note?: string;
  timestamp: string;
}

// Assignment history (claim / reassign / team change). Separate from status.
export interface Assignment {
  id: string;
  ticketId: string;
  actor: string;
  fromAssigneeId?: string;
  toAssigneeId?: string;
  fromTeamId?: string;
  toTeamId?: string;
  timestamp: string;
}

// Escalation history — the Escalated view/timeline reads this. Escalation is a
// SEPARATE dimension from workflow status (docs/product-rules.md #2).
export interface Escalation {
  id: string;
  ticketId: string;
  actor: string;
  direction: 'escalate' | 'de-escalate';
  fromTier: SupportTier;
  toTier: SupportTier;
  fromTeamId: string;
  toTeamId: string;
  reason?: string;
  note: string;
  timestamp: string;
}

export type EscalationReason =
  | 'needs_specialist'
  | 'complex_case'
  | 'policy_exception'
  | 'high_value';

export const ESCALATION_REASON_LABELS: Record<EscalationReason, string> = {
  needs_specialist: 'Needs specialist',
  complex_case: 'Complex case',
  policy_exception: 'Policy exception',
  high_value: 'High-value / VIP',
};

// Simulated secure-link grant. A ticket reference alone does NOT grant portal
// access — the portal resolves this opaque token (docs/product-rules.md #6).
export interface RequesterAccess {
  ticketId: string;
  accessToken: string;
  issuedAt: string;
  expiresAt?: string;
}

// Mock pass-through for "from transaction" prefill (no OMS call).
export interface RelatedTransaction {
  id: string;
  trackingNumber?: string;
  orderId?: string;
  shipmentStatus?: string;
  requesterName?: string;
  requesterEmail?: string;
  requesterMobile?: string;
}

export interface MockAttachment {
  name: string;
  size: number;
  type: string;
}

export type ResolutionType = 'solved' | 'duplicate' | 'no_response' | 'not_reproducible';

export const RESOLUTION_LABELS: Record<ResolutionType, string> = {
  solved: 'Solved',
  duplicate: 'Duplicate',
  no_response: 'No response',
  not_reproducible: 'Not reproducible',
};

// SLA state for a single target (first-response or resolution). Computed against
// the simulated clock; independent of ticket status and escalation.
export type SlaState = 'on_track' | 'at_risk' | 'breached' | 'met' | 'paused';

export interface SlaTargetSummary {
  state: SlaState;
  /** Target deadline (ISO), for display. */
  dueAt?: string;
}

export interface SlaSummary {
  firstResponse: SlaTargetSummary;
  resolution: SlaTargetSummary;
}

// ── View models (composed by services for agent-facing screens) ──────────────

export interface TicketListItem {
  ticket: Ticket;
  requesterName: string;
  teamName: string;
  categoryName: string;
  assigneeName?: string;
  sla: SlaSummary;
}

export type TimelineEventType = 'status' | 'note' | 'assignment' | 'escalation';

export interface TimelineEvent {
  id: string;
  type: TimelineEventType;
  actor: string;
  summary: string;
  timestamp: string;
}

export interface TicketDetailView {
  ticket: Ticket;
  requester: Requester;
  teamName: string;
  categoryName: string;
  subcategoryName?: string;
  assigneeName?: string;
  messages: TicketMessage[];
  notes: InternalNote[];
  timeline: TimelineEvent[];
  sla: SlaSummary;
}

export const STATUS_LABELS: Record<TicketStatus, string> = {
  new: 'New',
  open: 'Open',
  in_progress: 'In Progress',
  pending_requester: 'Pending Requester',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened',
};

export type BadgeVariant = 'default' | 'outline' | 'brand' | 'destructive' | 'success' | 'warning' | 'info';

export function statusBadgeVariant(status: TicketStatus): BadgeVariant {
  switch (status) {
    case 'new':
    case 'open':
      return 'info';
    case 'in_progress':
      return 'brand';
    case 'pending_requester':
    case 'reopened':
      return 'warning';
    case 'resolved':
      return 'success';
    case 'closed':
      return 'default';
  }
}
