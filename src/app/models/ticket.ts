// Typed ticket contracts (docs/mock-data-model.md). Status and escalationState
// are INDEPENDENT fields — a ticket can be in_progress while escalated
// (docs/product-rules.md #2). Classification fields stay separate (#1).

// Six core statuses. "Pending Requester" and "Reopened" were folded away:
//   - waiting on someone is now `on_hold` + a `holdReason` (who we're waiting on),
//     so being blocked by the requester, an internal team, or a third party is one
//     state with a reason rather than three near-duplicate statuses;
//   - reopening is an EVENT, not a state — a reopened ticket returns to `open` (or
//     `in_progress` if it still has an assignee) and carries `reopenedAt`.
// Escalation remains a separate dimension entirely (docs/product-rules.md #2).
export type TicketStatus =
  | 'new'
  | 'open'
  | 'in_progress'
  | 'on_hold'
  | 'resolved'
  | 'closed';

/** Why an on-hold ticket is blocked. Only meaningful while status === 'on_hold'. */
export type HoldReason =
  | 'waiting_requester'
  | 'waiting_internal'
  | 'waiting_third_party'
  | 'scheduled_follow_up'
  | 'other';

export const HOLD_REASON_LABELS: Record<HoldReason, string> = {
  waiting_requester: 'Waiting for requester',
  waiting_internal: 'Waiting for internal team',
  waiting_third_party: 'Waiting for third party',
  scheduled_follow_up: 'Scheduled follow-up',
  other: 'Other',
};

export const HOLD_REASONS = Object.keys(HOLD_REASON_LABELS) as HoldReason[];

export type EscalationState = 'none' | 'escalated' | 'returned_to_l1';
export type SupportTier = 'L1' | 'L2';
export type TicketSource = 'web' | 'email' | 'transaction' | 'api' | 'internal';
export type TicketPriority = 'normal' | 'high' | 'urgent';
export type MessageAuthorType = 'requester' | 'agent' | 'system';

/** GGX shipment tracking number — three hyphen-separated groups of four. */
export const TRACKING_NUMBER_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

export function isTrackingNumber(value: string): boolean {
  return TRACKING_NUMBER_PATTERN.test(value.trim().toUpperCase());
}

// Concern Type (M15) — a controlled triage descriptor shown in agent queues so
// agents grasp the issue before opening a ticket. It is a SEPARATE field from
// category/subcategory/status/priority/escalation/team (docs/product-rules.md
// #16); it never merges with or replaces any of them.
export type ConcernType =
  | 'delivery_delay'
  | 'pickup_issue'
  | 'missing_parcel'
  | 'damaged_parcel'
  | 'cod_concern'
  | 'remittance_concern'
  | 'payment_issue'
  | 'booking_issue'
  | 'address_correction'
  | 'account_concern'
  | 'general_inquiry';

export const CONCERN_TYPE_LABELS: Record<ConcernType, string> = {
  delivery_delay: 'Delivery delay',
  pickup_issue: 'Pickup issue',
  missing_parcel: 'Missing parcel',
  damaged_parcel: 'Damaged parcel',
  cod_concern: 'COD concern',
  remittance_concern: 'Remittance concern',
  payment_issue: 'Payment issue',
  booking_issue: 'Booking issue',
  address_correction: 'Address correction',
  account_concern: 'Account concern',
  general_inquiry: 'General inquiry',
};

// Ordered list for pickers.
export const CONCERN_TYPES = Object.keys(CONCERN_TYPE_LABELS) as ConcernType[];

export interface Requester {
  id: string;
  name: string;
  email: string;
  mobile?: string;
  isGuest: boolean;
  linkedCustomerId?: string;
  brandId: string;
}

// ── Provenance & customer visibility (M23) ───────────────────────────────────
// Who opened a ticket, through which channel, and whether the customer may see
// it. These are what the server's visibility policy is enforced on — a ticket is
// NEVER exposed to a customer merely because it references their order or
// account (docs/business-plus-integration.md).

/** Who actually opened the ticket. */
export type TicketCreatorType = 'requester' | 'agent' | 'system';

/** The channel it arrived through. */
export type TicketSourceChannel =
  | 'business_plus' // submitted by a signed-in Business+ requester
  | 'heyq_web'      // HeyQ's own contact form
  | 'email'
  | 'internal'      // staff-raised, internal-only by default
  | 'proactive';    // support opened it FOR a customer

export interface Ticket {
  id: string;
  reference: string;
  brandId: string;
  requesterId: string;

  // ── Provenance + visibility ────────────────────────────────────────────────
  /** Who opened it. Agent/system tickets are never customer-visible by default. */
  creatorType: TicketCreatorType;
  sourceChannel: TicketSourceChannel;
  /**
   * The external (Business+) identity this ticket belongs to. Absent on tickets
   * with no Business+ requester — which therefore can never be customer-visible.
   */
  requesterExternalUserId?: string;
  requesterExternalOrgId?: string;
  /** Master switch: may this ticket be shown in the customer's app at all? */
  customerVisible: boolean;
  /** When true, anyone in the account may see it — not just the submitting user. */
  accountVisible?: boolean;
  /** Whether the customer has been told this ticket exists. */
  customerNotified?: boolean;
  subject: string;
  description: string;
  categoryId: string;
  subcategoryId?: string;
  concernType?: ConcernType; // M15 — separate triage descriptor (product rule #16)
  status: TicketStatus;
  /** Set only while status === 'on_hold' — what the ticket is blocked on. */
  holdReason?: HoldReason;
  /** Reopen is an event, not a status: the ticket goes back to open/in_progress. */
  reopenedAt?: string;
  escalationState: EscalationState;
  supportTier: SupportTier;
  teamId: string;
  priority: TicketPriority;
  severity?: string;
  resolutionType?: string;
  source: TicketSource;
  // M16 — internal tickets: the submitting employee, and whether requester-facing
  // communication is on. Disabled by default for source==='internal' (rule #18).
  reporterId?: string;
  requesterNotificationsEnabled?: boolean;
  assigneeId?: string;
  relatedTransactionId?: string;
  // M22 — which external system originated the ticket, and the order it links.
  // Both optional: manual / non-GGX flows are unchanged.
  sourceSystem?: ExternalSourceSystem;
  linkedOrder?: LinkedOrder;
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
  /** Attachment METADATA only (name/size/type). Agent-only, like the note. */
  attachments?: MockAttachment[];
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
  /** Attachment METADATA only (name/size/type) sent with a public reply. */
  attachments?: MockAttachment[];
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

// ── GGX transaction context (M13) ────────────────────────────────────────────
// Shipment, payment, and remittance statuses are THREE INDEPENDENT dimensions,
// and all three are independent of the support ticket's workflow status
// (docs/product-rules.md #13). Sender/recipient are masked (#15). No OMS call —
// this is a mock reached only through transactionService (#14).

export type ShipmentStatus =
  | 'booked'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed_delivery'
  | 'returned'
  | 'cancelled'
  | 'on_hold';

export type PaymentStatus = 'unpaid' | 'paid' | 'refunded' | 'failed';
export type RemittanceStatus = 'not_applicable' | 'pending' | 'remitted' | 'on_hold';

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  booked: 'Booked',
  picked_up: 'Picked up',
  in_transit: 'In transit',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  failed_delivery: 'Failed delivery',
  returned: 'Returned',
  cancelled: 'Cancelled',
  on_hold: 'On hold',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  refunded: 'Refunded',
  failed: 'Failed',
};

export const REMITTANCE_STATUS_LABELS: Record<RemittanceStatus, string> = {
  not_applicable: 'Not applicable',
  pending: 'Pending',
  remitted: 'Remitted',
  on_hold: 'On hold',
};

export interface TransactionCharge {
  label: string;
  amount: number;
}

export interface TransactionException {
  type: 'failed_attempt' | 'return' | 'cancellation' | 'exception';
  reason?: string;
  at: string;
}

export interface RelatedTransaction {
  id: string;
  trackingNumber: string;
  orderId?: string;
  // Delivery / shipment status (separate from payment/remittance and ticket status).
  shipmentStatus: ShipmentStatus;
  origin?: string;
  destination?: string;
  // Sender/recipient are masked for display (product rule #15).
  senderMasked?: string;
  recipientMasked?: string;
  // Contact-form prefill fields (kept from M4's transaction-prefill flow).
  requesterName?: string;
  requesterEmail?: string;
  requesterMobile?: string;
  bookingDate?: string;
  pickupDate?: string;
  deliveryDate?: string;
  latestMovementAt?: string;
  currency?: string;
  shippingFee?: number;
  charges?: TransactionCharge[];
  paymentMethod?: string;
  paymentStatus?: PaymentStatus;
  codAmount?: number;
  remittanceStatus?: RemittanceStatus;
  exceptions?: TransactionException[];
  // Provenance + freshness for the "data source" and "stale data" states.
  dataSource: string;
  lastUpdatedAt: string;
}

// ── Linked external order (M22 — GGX Business+) ──────────────────────────────
// A ticket raised from Business+ links an order by STABLE EXTERNAL ID and keeps a
// minimal snapshot captured at submission. The snapshot is what makes the ticket
// self-sufficient: it renders even when the provider is down or the order was
// deleted upstream. External IDs are reference data — never HeyQ primary keys.

export type ExternalSourceSystem = 'ggx_business_plus';

export const SOURCE_SYSTEM_LABELS: Record<ExternalSourceSystem, string> = {
  ggx_business_plus: 'GGX Business+',
};

/**
 * Minimal order context captured at submission — enough to triage, nothing more.
 *
 * Two upstream paths fill this, and each sends only what it is willing to share:
 *   • HeyQ's own order picker (mock provider) — sender/recipient summaries.
 *   • GGX Business+ — deliberately WITHHOLDS recipient, payment, COD, fees and
 *     parcel contents, and sends service type, a short delivery summary and a
 *     city-level route instead (its data-minimization contract).
 *
 * Everything past `bookingDate` is therefore optional: HeyQ renders exactly what
 * it was given and never invents the rest.
 */
export interface LinkedOrderSnapshot {
  /** Delivery/shipment status AT CAPTURE TIME. Independent of ticket status. */
  shipmentStatus: ShipmentStatus;
  bookingDate: string;
  destination?: string;
  /** Limited summaries, not full contact records (mirrors the masking rule #15). */
  senderSummary?: string;
  recipientSummary?: string;
  /** Business+ path: Standard / Same-Day / On-Demand. */
  serviceType?: string;
  /** Business+ path: short, non-identifying summary (e.g. "Express delivery"). */
  deliverySummary?: string;
  /** Business+ path: city-level route only (e.g. "Makati City → Pasig City"). */
  route?: string;
}

export interface LinkedOrder {
  /** Stable Business+ order/shipment id. Reference data only. */
  externalOrderId: string;
  trackingNumber: string;
  snapshot: LinkedOrderSnapshot;
  /** When the snapshot was captured — shown so agents know how old it is. */
  capturedAt: string;
}

// ── Customer projection (M23) ────────────────────────────────────────────────
// What the server returns to a CUSTOMER client (GGX Business+). This type IS the
// privacy boundary: it has no field for internal notes, assignee identity,
// escalation state, support tier, SLA, or team queue, so none of them can be
// serialized into a customer response by accident. The handling TEAM is
// customer-safe and is what replaces the agent's name.

export interface CustomerTicketMessage {
  id: string;
  /** Never an individual agent identity. */
  from: 'you' | 'support' | 'system';
  /** Team name for support replies (e.g. "Claims"), or "You"/"HeyQ". */
  authorLabel: string;
  body: string;
  /** Attachments on this PUBLIC message — safe to show the customer. */
  attachments?: MockAttachment[];
  createdAt: string;
}

export interface CustomerTicket {
  id: string;
  reference: string;
  subject: string;
  concernType?: ConcernType;
  /** Human label for the concern. */
  issueType: string;
  /** SUPPORT-TICKET status — distinct from the order's delivery status. */
  status: TicketStatus;
  priority: TicketPriority;
  /** Handling team, never the agent. */
  supportTeam: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  reopenedAt?: string;
  /**
   * True when SUPPORT opened this ticket, not the customer (proactive outreach).
   * The customer app must label it as such and never present it as self-submitted.
   */
  openedBySupport: boolean;
  linkedOrder?: LinkedOrder;
  messages: CustomerTicketMessage[];
  canReopen: boolean;
}

/**
 * Attachment METADATA carried on a message/note payload. `id` is present for
 * REAL uploaded attachments (server-stored; downloadable via the attachments
 * endpoints) and absent for the legacy metadata-only path. Bytes are NEVER
 * embedded here — only the reference metadata.
 */
export interface MockAttachment {
  /** Stored-attachment id when this file was really uploaded; absent for metadata-only. */
  id?: string;
  name: string;
  size: number;
  type: string;
}

/** Who attached a file. Mirrors message author roles. */
export type AttachmentUploaderType = 'requester' | 'agent' | 'system';

/**
 * A stored ticket attachment — the server-owned metadata record for one uploaded
 * file. The bytes live in the server's object store keyed by `storedName` (a safe,
 * server-generated key — NEVER the original filename). Every attachment belongs to
 * a ticket; `messageId` records which conversation message (or the initial
 * description on creation) it was shared on, so the UI can show where it came from.
 * One record per file means a ticket's consolidated list has no duplicates.
 */
export interface TicketAttachment {
  id: string;
  ticketId: string;
  /** The message this file was attached to (creation description or a reply). */
  messageId?: string;
  uploaderType: AttachmentUploaderType;
  /** Uploader id (requester id or agent id). */
  uploaderId: string;
  /** Original client filename (display + sanitized on download). */
  originalName: string;
  /** Safe server-generated object key — the storage path. Never the original name. */
  storedName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
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
  /** Denormalized from the linked GGX transaction; absent on non-shipment tickets. */
  trackingNumber?: string;
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
  on_hold: 'On Hold',
  resolved: 'Resolved',
  closed: 'Closed',
};

/** Ordered for pickers and status filters. */
export const TICKET_STATUSES = Object.keys(STATUS_LABELS) as TicketStatus[];

export const STATUS_DESCRIPTIONS: Record<TicketStatus, string> = {
  new: 'Not yet reviewed',
  open: 'Reviewed and ready for action',
  in_progress: 'Actively being handled',
  on_hold: 'Temporarily blocked',
  resolved: 'Solution provided',
  closed: 'Finalized',
};

export type BadgeVariant =
  | 'default'
  | 'outline'
  | 'brand'
  | 'destructive'
  | 'success'
  | 'warning'
  | 'info'
  | 'info-solid'
  | 'teal';

/**
 * Status carries SEMANTIC colour, never brand colour: blue tones for active
 * work (each stage a step deeper — soft for New, solid for Open, teal for In
 * Progress), green for resolved, grey for closed, restrained amber for
 * blocked. In particular In Progress is blue/teal, not brand red — red means
 * urgent/breached/failed, and a ticket simply being worked on is neither.
 */
export function statusBadgeVariant(status: TicketStatus): BadgeVariant {
  switch (status) {
    case 'new':
      return 'info';
    case 'open':
      return 'info-solid';
    case 'in_progress':
      return 'teal';
    case 'on_hold':
      return 'warning';
    case 'resolved':
      return 'success';
    case 'closed':
      return 'default';
  }
}
