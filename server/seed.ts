/**
 * Seed state for the mock HeyQ server.
 *
 * This is the ticket data that used to live in `src/app/data/tickets.ts` — it
 * now lives server-side, because HeyQ (the server) is the sole owner of ticket
 * state. The browser has no ticket store any more.
 *
 * `createSeedState()` returns a FRESH deep copy every call, so each isolated
 * store (see store.ts) starts from the same known state.
 *
 * The seed deliberately covers every state the UI has to render: all six core
 * statuses, both an external and an internal hold reason, an escalated ticket, a
 * reopened one, tickets with and without a GGX shipment, all three priorities,
 * and on-track / at-risk / breached SLA — plus, since M23, every VISIBILITY case:
 * a Business+ submission, a HeyQ-web submission, an internal/agent-created
 * ticket, and a proactive support ticket.
 */
import type {
  Assignment,
  Escalation,
  InternalNote,
  Requester,
  RequesterAccess,
  StatusEvent,
  Ticket,
  TicketAttachment,
  TicketMessage,
} from '../src/app/models/ticket.ts';
import type { AiFinding, AiReviewConfig, QualityReview } from '../src/app/models/review.ts';
import { computeReviewScore } from '../src/app/services/reviewScoring.ts';
import type { Notification, NotificationEvent } from '../src/app/models/notification.ts';
import type {
  BusinessPlusOrderRecord,
  BusinessPlusOrg,
  BusinessPlusUser,
} from '../src/app/data/businessPlusOrders.ts';

const BRAND = 'ggx';

// The signed-in GGX Business+ demo user (Admin, `main` account scope). Business+
// passes this identity on every requester call; it is what customer visibility
// is scoped to.
export const BP_DEMO_USER = 'max@email.com';
export const BP_DEMO_ORG = 'main';

/**
 * The Phase 1 stand-in model. Named so it can never be mistaken for a real hosted
 * model in a screenshot or a stored record — the Hugging Face/Gemma identifier
 * replaces this value when the real transport lands, with no other change.
 */
export const FAKE_AI_MODEL = 'heyq-fake-reviewer';

/**
 * AI Review defaults. 80% sits inside the board's existing 70–89 middle band —
 * above the band the UI already treats as poor, below the 90+ band it treats as
 * strong — so it flags middling handling without flooding supervisors.
 */
export const DEFAULT_REVIEW_CONFIG: AiReviewConfig = {
  enabled: true,
  requireSupervisorBelowPercent: 80,
  model: FAKE_AI_MODEL,
  promptVersion: 'v1',
};

export interface SeedState {
  requesters: Requester[];
  tickets: Ticket[];
  ticketMessages: TicketMessage[];
  internalNotes: InternalNote[];
  statusEvents: StatusEvent[];
  assignments: Assignment[];
  escalations: Escalation[];
  requesterAccess: RequesterAccess[];
  // Stored ticket attachment METADATA (bytes live in server/attachments.ts's
  // object store, keyed by storedName — never cloned into this state). One record
  // per uploaded file gives a ticket a duplicate-free consolidated list.
  attachments: TicketAttachment[];
  // Quality reviews (Supervisor feature) — a lead's structured assessment of how
  // an agent handled a ticket. Kept in the same store because the workspace reads
  // ticket evidence and the review together; reviews never mutate ticket state.
  qualityReviews: QualityReview[];
  /**
   * AI Review configuration. Server-owned and read on every AI run, so the toggle
   * and threshold cannot be bypassed from the browser. Deliberately NOT modelled
   * on `slaConfig` (src/app/data/catalog.ts), which is browser module state the
   * server never sees and therefore could not enforce.
   */
  reviewConfig: AiReviewConfig;
  referenceSeq: number;
  // Notifications (ported from src/app/data/notifications.ts, M23/M24 — HeyQ is
  // the sole owner of ticket state, and emit() fires synchronously inside the
  // ticket lifecycle functions, so its state has to live in the same store).
  notifications: Notification[];
  notificationPrefs: { muted: NotificationEvent[] };
  // Mock Business+ order catalogue (ported from src/app/data/businessPlusOrders.ts).
  // The "provider unavailable" simulation is store.ts's generic isDown/setDown,
  // not a separate flag here.
  businessPlusOrgs: BusinessPlusOrg[];
  businessPlusUsers: BusinessPlusUser[];
  businessPlusOrders: BusinessPlusOrderRecord[];
}

function seed(): SeedState {
  const requesters: Requester[] = [
    { id: 'req-seed-1', name: 'Liza Aquino', email: 'liza.aquino@example.com', mobile: '+63 917 555 0110', isGuest: true, brandId: BRAND },
    { id: 'req-seed-2', name: 'Marco Reyes', email: 'marco.reyes@example.com', mobile: '+63 917 555 0121', isGuest: true, brandId: BRAND },
    { id: 'req-seed-3', name: 'Nadia Cruz', email: 'nadia.cruz@example.com', mobile: '+63 917 555 0133', isGuest: true, brandId: BRAND },
    { id: 'req-seed-4', name: 'Oliver Tan', email: 'oliver.tan@example.com', isGuest: true, brandId: BRAND },
    { id: 'req-seed-5', name: 'Paula Reyes', email: 'paula.reyes@example.com', mobile: '+63 917 555 0155', isGuest: true, brandId: BRAND },
    { id: 'req-seed-6', name: 'Quentin Lim', email: 'quentin.lim@example.com', isGuest: true, brandId: BRAND },
    { id: 'req-seed-7', name: 'Grace Fernandez', email: 'grace.f@example.com', mobile: '+63 917 555 0166', isGuest: true, brandId: BRAND },
    { id: 'req-seed-8', name: 'Dominic Ramos', email: 'dominic.r@example.com', mobile: '+63 917 555 0177', isGuest: true, brandId: BRAND },
    { id: 'req-seed-9', name: 'Karla Uy', email: 'karla.uy@example.com', isGuest: true, brandId: BRAND },
    { id: 'req-seed-10', name: 'Ben Alvarez', email: 'ben.alvarez@example.com', mobile: '+63 917 555 0188', isGuest: true, brandId: BRAND },
    { id: 'req-seed-11', name: 'Faye Bautista', email: 'faye.b@example.com', isGuest: true, brandId: BRAND },
    { id: 'req-seed-12', name: 'Nico Flores', email: 'nico.flores@example.com', mobile: '+63 917 555 0199', isGuest: true, brandId: BRAND },
    // The GGX Business+ signed-in user (M23). Not a guest — an authenticated
    // upstream identity, which is why their tickets can be customer-visible.
    { id: 'req-bp-max', name: 'Max Rodriguez', email: BP_DEMO_USER, isGuest: false, brandId: BRAND },
  ];

  // Everything a HeyQ-web guest submits is customerVisible: false — those
  // requesters have no Business+ identity, so there is no customer app to show
  // them in. Visibility is never inferred from the order or the account.
  const heyqWeb = { creatorType: 'requester', sourceChannel: 'heyq_web', customerVisible: false } as const;

  const tickets: Ticket[] = [
    {
      id: 'tkt-seed-1', reference: 'HQ-2026-0001', brandId: BRAND, requesterId: 'req-seed-1', ...heyqWeb,
      subject: 'Where is my parcel?', description: 'My parcel has not moved in three days.',
      categoryId: 'cat-delivery', subcategoryId: 'sub-del-status', concernType: 'delivery_delay',
      status: 'on_hold', holdReason: 'waiting_requester',
      escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
      priority: 'normal', source: 'web', relatedTransactionId: 'TXN-2001', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-08T02:15:00Z', updatedAt: '2026-07-09T06:40:00Z', firstResponseAt: '2026-07-08T03:00:00Z',
    },
    {
      id: 'tkt-seed-2', reference: 'HQ-2026-0002', brandId: BRAND, requesterId: 'req-seed-2', ...heyqWeb,
      subject: 'COD remittance not received', description: 'I have not received my COD remittance for last week.',
      categoryId: 'cat-cod', subcategoryId: 'sub-cod-remit', concernType: 'remittance_concern',
      status: 'resolved', escalationState: 'none', supportTier: 'L2', teamId: 'team-payments',
      priority: 'high', source: 'web', relatedTransactionId: 'TXN-2002', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-05T01:00:00Z', updatedAt: '2026-07-07T08:30:00Z', firstResponseAt: '2026-07-05T02:10:00Z', resolvedAt: '2026-07-07T08:30:00Z',
    },
    // Unassigned, team-cs, fresh — first-response on track.
    {
      id: 'tkt-seed-3', reference: 'HQ-2026-0003', brandId: BRAND, requesterId: 'req-seed-3', ...heyqWeb,
      subject: 'Rider did not arrive for pickup', description: 'I booked a pickup this morning but no rider came.',
      categoryId: 'cat-pickup', subcategoryId: 'sub-pu-missed', concernType: 'pickup_issue',
      status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
      priority: 'normal', source: 'web', relatedTransactionId: 'TXN-2003', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-14T08:00:00Z', updatedAt: '2026-07-14T08:00:00Z',
    },
    // Assigned to l1_agent, in progress — first-response met, resolution on track.
    {
      id: 'tkt-seed-4', reference: 'HQ-2026-0004', brandId: BRAND, requesterId: 'req-seed-4', ...heyqWeb,
      subject: 'App crashes when opening bookings', description: 'The app closes whenever I tap on My Bookings.',
      categoryId: 'cat-technical', subcategoryId: 'sub-tech-app', concernType: 'booking_issue',
      status: 'in_progress', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
      priority: 'high', source: 'web', assigneeId: 'l1_agent', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-14T04:00:00Z', updatedAt: '2026-07-14T04:30:00Z', firstResponseAt: '2026-07-14T04:30:00Z',
    },
    // Assigned to l1_agent, open, no first response yet — first-response BREACHED.
    {
      id: 'tkt-seed-5', reference: 'HQ-2026-0005', brandId: BRAND, requesterId: 'req-seed-5', ...heyqWeb,
      subject: 'Cannot log in to my account', description: 'I keep getting an error when signing in.',
      categoryId: 'cat-account', subcategoryId: 'sub-acc-access', concernType: 'account_concern',
      status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
      priority: 'urgent', source: 'web', assigneeId: 'l1_agent', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-13T20:00:00Z', updatedAt: '2026-07-13T20:00:00Z',
    },
    // Unassigned, team-claims, aging — first-response AT RISK.
    {
      id: 'tkt-seed-6', reference: 'HQ-2026-0006', brandId: BRAND, requesterId: 'req-seed-6', ...heyqWeb,
      subject: 'Claim for damaged parcel', description: 'My parcel arrived damaged and I want to file a claim.',
      categoryId: 'cat-claims', subcategoryId: 'sub-cl-damaged', concernType: 'damaged_parcel',
      status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-claims',
      priority: 'high', source: 'web', relatedTransactionId: 'TXN-2004', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-14T05:30:00Z', updatedAt: '2026-07-14T05:30:00Z',
    },
    // Escalated to L2 (Claims) — status stays in_progress; resolution BREACHED.
    {
      id: 'tkt-seed-7', reference: 'HQ-2026-0007', brandId: BRAND, requesterId: 'req-seed-3', ...heyqWeb,
      subject: 'Lost parcel — high value', description: 'A high-value parcel has been missing for over a week.',
      categoryId: 'cat-claims', subcategoryId: 'sub-cl-lost', concernType: 'missing_parcel',
      status: 'in_progress', escalationState: 'escalated', supportTier: 'L2', teamId: 'team-claims',
      priority: 'urgent', source: 'web', assigneeId: 'l2_specialist', relatedTransactionId: 'TXN-2005', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-12T09:00:00Z', updatedAt: '2026-07-13T09:00:00Z', firstResponseAt: '2026-07-12T10:00:00Z', escalatedAt: '2026-07-13T09:00:00Z',
    },
    // Assigned to l1_agent, pending requester — resolution clock PAUSED.
    {
      id: 'tkt-seed-8', reference: 'HQ-2026-0008', brandId: BRAND, requesterId: 'req-seed-3', ...heyqWeb,
      subject: 'Question about my invoice', description: 'Could you clarify a charge on my latest invoice?',
      categoryId: 'cat-general', subcategoryId: 'sub-gen-info', concernType: 'payment_issue',
      status: 'on_hold', holdReason: 'waiting_requester',
      escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
      priority: 'normal', source: 'web', assigneeId: 'l1_agent', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-13T09:00:00Z', updatedAt: '2026-07-13T12:00:00Z', firstResponseAt: '2026-07-13T09:45:00Z',
    },
    // ── M13 transaction-context scenarios (each links a GGX transaction) ────────
    {
      id: 'tkt-seed-9', reference: 'HQ-2026-0009', brandId: BRAND, requesterId: 'req-seed-7', ...heyqWeb,
      subject: 'Parcel marked delivered but I never received it', description: 'Tracking says delivered yesterday but nothing arrived.',
      categoryId: 'cat-delivery', subcategoryId: 'sub-del-status', concernType: 'missing_parcel',
      status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
      priority: 'high', source: 'web', relatedTransactionId: 'TXN-2006', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-14T01:00:00Z', updatedAt: '2026-07-14T01:00:00Z',
    },
    {
      id: 'tkt-seed-10', reference: 'HQ-2026-0010', brandId: BRAND, requesterId: 'req-seed-8', ...heyqWeb,
      subject: 'COD amount collected was higher than my order', description: 'The rider collected ₱2,000 but my order was ₱1,750.',
      categoryId: 'cat-cod', subcategoryId: 'sub-cod-amount', concernType: 'cod_concern',
      status: 'on_hold', holdReason: 'waiting_third_party',
      escalationState: 'none', supportTier: 'L1', teamId: 'team-payments',
      priority: 'high', source: 'web', assigneeId: 'l2_specialist', relatedTransactionId: 'TXN-2007', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-12T03:00:00Z', updatedAt: '2026-07-13T02:00:00Z', firstResponseAt: '2026-07-12T04:00:00Z',
    },
    {
      id: 'tkt-seed-11', reference: 'HQ-2026-0011', brandId: BRAND, requesterId: 'req-seed-9', ...heyqWeb,
      subject: 'Delivery failed but no reason was given', description: 'I got a failed delivery notice with no explanation.',
      categoryId: 'cat-delivery', subcategoryId: 'sub-del-late', concernType: 'delivery_delay',
      status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
      priority: 'normal', source: 'web', relatedTransactionId: 'TXN-2008', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-13T12:00:00Z', updatedAt: '2026-07-13T12:00:00Z',
    },
    {
      id: 'tkt-seed-12', reference: 'HQ-2026-0012', brandId: BRAND, requesterId: 'req-seed-10', ...heyqWeb,
      subject: 'Disputing a return fee on my parcel', description: 'My parcel was returned and I was charged a return fee I do not agree with.',
      categoryId: 'cat-returns', subcategoryId: 'sub-ret-status', concernType: 'general_inquiry',
      status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-claims',
      priority: 'normal', source: 'web', relatedTransactionId: 'TXN-2009', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-12T06:00:00Z', updatedAt: '2026-07-12T06:00:00Z',
    },
    {
      id: 'tkt-seed-13', reference: 'HQ-2026-0013', brandId: BRAND, requesterId: 'req-seed-11', ...heyqWeb,
      subject: 'Paid but my booking was never created', description: 'I paid for a shipment but no booking or pickup was scheduled.',
      categoryId: 'cat-payment', subcategoryId: 'sub-pay-failed', concernType: 'booking_issue',
      status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-payments',
      priority: 'urgent', source: 'web', relatedTransactionId: 'TXN-2010', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-14T01:30:00Z', updatedAt: '2026-07-14T01:30:00Z',
    },
    // Incorrect recipient address — just arrived, NOT yet reviewed (status New).
    {
      id: 'tkt-seed-14', reference: 'HQ-2026-0014', brandId: BRAND, requesterId: 'req-seed-12', ...heyqWeb,
      subject: 'Need to correct the recipient address', description: 'The delivery address on my parcel is wrong — please update it.',
      categoryId: 'cat-delivery', subcategoryId: 'sub-del-status', concernType: 'address_correction',
      status: 'new', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
      priority: 'normal', source: 'web', relatedTransactionId: 'TXN-2011', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-14T02:30:00Z', updatedAt: '2026-07-14T02:30:00Z',
    },
    // Closed out earlier on the simulated day — gives the Overview's "Resolved
    // today" counter a live value instead of a permanent zero.
    {
      id: 'tkt-seed-15', reference: 'HQ-2026-0015', brandId: BRAND, requesterId: 'req-seed-5', ...heyqWeb,
      subject: 'Reschedule my delivery to tomorrow', description: 'Nobody will be home today — can the delivery move to tomorrow?',
      categoryId: 'cat-delivery', subcategoryId: 'sub-del-status', concernType: 'delivery_delay',
      status: 'resolved', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
      priority: 'normal', source: 'web', assigneeId: 'l1_agent', slaPolicyId: 'sla-standard',
      resolutionType: 'solved',
      createdAt: '2026-07-14T03:00:00Z', updatedAt: '2026-07-14T06:00:00Z',
      firstResponseAt: '2026-07-14T03:20:00Z', resolvedAt: '2026-07-14T06:00:00Z',
    },
    // CLOSED — finalized, no further action. Non-shipment (no tracking number).
    {
      id: 'tkt-seed-16', reference: 'HQ-2026-0016', brandId: BRAND, requesterId: 'req-seed-6', ...heyqWeb,
      subject: 'How do I change my billing email?', description: 'I want invoices sent to a different address.',
      categoryId: 'cat-account', subcategoryId: 'sub-acc-access', concernType: 'account_concern',
      status: 'closed', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
      priority: 'normal', source: 'web', assigneeId: 'l1_agent', slaPolicyId: 'sla-standard',
      resolutionType: 'solved',
      createdAt: '2026-07-09T01:00:00Z', updatedAt: '2026-07-10T05:00:00Z',
      firstResponseAt: '2026-07-09T01:40:00Z', resolvedAt: '2026-07-09T23:00:00Z',
    },
    // REOPENED — reopening is an event, not a status.
    {
      id: 'tkt-seed-17', reference: 'HQ-2026-0017', brandId: BRAND, requesterId: 'req-seed-9', ...heyqWeb,
      subject: 'Parcel still not delivered after the promised date', description: 'You closed my last ticket but the parcel never arrived.',
      categoryId: 'cat-delivery', subcategoryId: 'sub-del-late', concernType: 'delivery_delay',
      status: 'in_progress', reopenedAt: '2026-07-13T22:00:00Z',
      escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
      priority: 'high', source: 'web', assigneeId: 'l1_agent', relatedTransactionId: 'TXN-1001', slaPolicyId: 'sla-standard',
      createdAt: '2026-07-11T07:00:00Z', updatedAt: '2026-07-13T22:00:00Z', firstResponseAt: '2026-07-11T08:00:00Z',
    },
    // GGX BUSINESS+ — submitted by Nadia (Acme Retail) through HeyQ's own contact
    // form with a linked order. Customer-visible, but to HER identity — not to the
    // Business+ demo user, who is a different requester in a different org.
    {
      id: 'tkt-seed-18', reference: 'HQ-2026-0018', brandId: BRAND, requesterId: 'req-seed-3',
      creatorType: 'requester', sourceChannel: 'business_plus', customerVisible: true,
      requesterExternalUserId: 'bp-user-nadia', requesterExternalOrgId: 'bp-org-acme',
      customerNotified: true,
      subject: 'Recipient reports the parcel has not moved', description: 'Our customer in Davao says tracking has shown In Transit for three days.',
      categoryId: 'cat-delivery', subcategoryId: 'sub-del-late', concernType: 'delivery_delay',
      status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
      priority: 'normal', source: 'web', sourceSystem: 'ggx_business_plus',
      linkedOrder: {
        externalOrderId: 'BP-ORD-7003', trackingNumber: 'Y6TN-4QSV-D28E',
        capturedAt: '2026-07-13T05:00:00Z',
        snapshot: {
          shipmentStatus: 'in_transit', bookingDate: '2026-07-08T01:15:00Z',
          senderSummary: 'Acme Retail — Warehouse 3', recipientSummary: 'M. Santos, Davao',
          destination: 'Davao City',
        },
      },
      slaPolicyId: 'sla-standard',
      createdAt: '2026-07-13T05:00:00Z', updatedAt: '2026-07-13T05:00:00Z', firstResponseAt: '2026-07-13T06:00:00Z',
    },

    // ── M23: the GGX Business+ demo user's own tickets ────────────────────────
    // Submitted from Business+ by the signed-in requester → visible to them
    // (visibility rule 1). Escalated AND in_progress: the two are independent.
    {
      id: 'tkt-bp-1', reference: 'HQ-2026-0101', brandId: BRAND, requesterId: 'req-bp-max',
      creatorType: 'requester', sourceChannel: 'business_plus', customerVisible: true,
      requesterExternalUserId: BP_DEMO_USER, requesterExternalOrgId: BP_DEMO_ORG, customerNotified: true,
      subject: 'Delivery failed but recipient was available',
      description: 'The rider marked this as a failed delivery, but our recipient confirms they were on site all afternoon. Please re-attempt.',
      categoryId: 'cat-delivery', subcategoryId: 'sub-del-status', concernType: 'delivery_delay',
      status: 'in_progress', escalationState: 'escalated', supportTier: 'L2', teamId: 'team-claims',
      priority: 'high', source: 'web', sourceSystem: 'ggx_business_plus', assigneeId: 'l2_specialist',
      linkedOrder: {
        externalOrderId: 'GGX-2026-90008', trackingNumber: 'GGX-2026-90008',
        capturedAt: '2026-06-01T09:12:00Z',
        snapshot: {
          shipmentStatus: 'failed_delivery', bookingDate: '2026-05-31',
          destination: 'Pasig City', serviceType: 'On-Demand',
          deliverySummary: 'Standard delivery', route: 'Metro Manila → Pasig City',
        },
      },
      slaPolicyId: 'sla-standard',
      createdAt: '2026-06-01T09:12:00Z', updatedAt: '2026-06-02T08:05:00Z',
      firstResponseAt: '2026-06-01T11:40:00Z', escalatedAt: '2026-06-01T12:02:00Z',
    },
    // On hold on a third party.
    {
      id: 'tkt-bp-2', reference: 'HQ-2026-0102', brandId: BRAND, requesterId: 'req-bp-max',
      creatorType: 'requester', sourceChannel: 'business_plus', customerVisible: true,
      requesterExternalUserId: BP_DEMO_USER, requesterExternalOrgId: BP_DEMO_ORG, customerNotified: true,
      subject: 'Parcel still in transit past the promised date',
      description: 'This parcel has been in transit for five days with no movement. Can you check with the hub?',
      categoryId: 'cat-delivery', subcategoryId: 'sub-del-late', concernType: 'delivery_delay',
      status: 'on_hold', holdReason: 'waiting_third_party',
      escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
      priority: 'normal', source: 'web', sourceSystem: 'ggx_business_plus', assigneeId: 'l1_agent',
      linkedOrder: {
        externalOrderId: 'GGX-2026-90004', trackingNumber: 'GGX-2026-90004',
        capturedAt: '2026-06-01T02:30:00Z',
        snapshot: {
          shipmentStatus: 'in_transit', bookingDate: '2026-05-30',
          destination: 'Iloilo City', serviceType: 'Standard',
          deliverySummary: 'Standard delivery', route: 'Metro Manila → Iloilo City',
        },
      },
      slaPolicyId: 'sla-standard',
      createdAt: '2026-06-01T02:30:00Z', updatedAt: '2026-06-01T06:15:00Z', firstResponseAt: '2026-06-01T06:15:00Z',
    },
    // Resolved — reopenable by the customer. Its snapshot is STALE by design:
    // captured at 'booked', while OMS has since moved the order to picked-up.
    {
      id: 'tkt-bp-3', reference: 'HQ-2026-0103', brandId: BRAND, requesterId: 'req-bp-max',
      creatorType: 'requester', sourceChannel: 'business_plus', customerVisible: true,
      requesterExternalUserId: BP_DEMO_USER, requesterExternalOrgId: BP_DEMO_ORG, customerNotified: true,
      subject: 'COD amount remitted does not match the order',
      description: 'The COD remitted for this order is short by ₱1,200 against what we booked.',
      categoryId: 'cat-cod', subcategoryId: 'sub-cod-amount', concernType: 'cod_concern',
      status: 'resolved', escalationState: 'none', supportTier: 'L1', teamId: 'team-payments',
      priority: 'high', source: 'web', sourceSystem: 'ggx_business_plus', assigneeId: 'l1_agent',
      resolutionType: 'solved',
      linkedOrder: {
        externalOrderId: 'GGX-2026-90001', trackingNumber: 'GGX-2026-90001',
        capturedAt: '2026-05-29T04:00:00Z',
        snapshot: {
          shipmentStatus: 'booked', bookingDate: '2026-05-29',
          destination: 'Davao City', serviceType: 'Standard',
          deliverySummary: 'Express delivery', route: 'Metro Manila → Davao City',
        },
      },
      slaPolicyId: 'sla-standard',
      createdAt: '2026-05-29T04:00:00Z', updatedAt: '2026-05-30T07:22:00Z',
      firstResponseAt: '2026-05-30T07:20:00Z', resolvedAt: '2026-05-30T07:22:00Z',
    },
    // Closed, no linked order — a general Business+ enquiry.
    {
      id: 'tkt-bp-4', reference: 'HQ-2026-0104', brandId: BRAND, requesterId: 'req-bp-max',
      creatorType: 'requester', sourceChannel: 'business_plus', customerVisible: true,
      requesterExternalUserId: BP_DEMO_USER, requesterExternalOrgId: BP_DEMO_ORG, customerNotified: true,
      subject: 'Invoice line item unclear',
      description: 'Could you break down the fuel surcharge line on last month’s invoice?',
      categoryId: 'cat-general', subcategoryId: 'sub-gen-info', concernType: 'payment_issue',
      status: 'closed', escalationState: 'none', supportTier: 'L1', teamId: 'team-payments',
      priority: 'normal', source: 'web', sourceSystem: 'ggx_business_plus', assigneeId: 'l1_agent',
      resolutionType: 'solved',
      slaPolicyId: 'sla-standard',
      createdAt: '2026-05-20T01:10:00Z', updatedAt: '2026-05-21T03:45:00Z',
      firstResponseAt: '2026-05-21T03:40:00Z', resolvedAt: '2026-05-21T03:45:00Z',
    },
    // Linked to an order that no longer resolves in OMS — the ticket must still
    // list, search and render, from its snapshot alone.
    {
      id: 'tkt-bp-5', reference: 'HQ-2026-0105', brandId: BRAND, requesterId: 'req-bp-max',
      creatorType: 'requester', sourceChannel: 'business_plus', customerVisible: true,
      requesterExternalUserId: BP_DEMO_USER, requesterExternalOrgId: BP_DEMO_ORG, customerNotified: true,
      subject: 'Package arrived damaged',
      description: 'The parcel arrived with a crushed corner and the contents are damaged.',
      categoryId: 'cat-claims', subcategoryId: 'sub-cl-damaged', concernType: 'damaged_parcel',
      status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-claims',
      priority: 'normal', source: 'web', sourceSystem: 'ggx_business_plus',
      linkedOrder: {
        externalOrderId: 'GGX-2023-00001', trackingNumber: 'GGX-2023-00001',
        capturedAt: '2026-05-15T05:00:00Z',
        snapshot: {
          shipmentStatus: 'delivered', bookingDate: '2026-05-12',
          destination: 'Cebu City', serviceType: 'Standard',
          deliverySummary: 'Standard delivery', route: 'Metro Manila → Cebu City',
        },
      },
      slaPolicyId: 'sla-standard',
      createdAt: '2026-05-15T05:00:00Z', updatedAt: '2026-05-15T05:00:00Z',
    },

    // ── M23: the tickets that must NOT leak into Business+ ────────────────────
    // AGENT-CREATED / INTERNAL. It names the SAME order and the SAME account as
    // tkt-bp-1 — and is still invisible to the customer, because order and
    // account ownership are not authorization (visibility rule 8).
    {
      id: 'tkt-internal-1', reference: 'HQ-2026-0106', brandId: BRAND, requesterId: 'req-bp-max',
      creatorType: 'agent', sourceChannel: 'internal', customerVisible: false,
      requesterExternalUserId: BP_DEMO_USER, requesterExternalOrgId: BP_DEMO_ORG,
      subject: 'Hub investigation — repeat failed delivery, Pasig route',
      description: 'Internal investigation into repeat mis-scans on the Pasig route. Do not disclose to the customer.',
      categoryId: 'cat-delivery', concernType: 'delivery_delay',
      status: 'in_progress', escalationState: 'none', supportTier: 'L2', teamId: 'team-claims',
      priority: 'high', source: 'internal', reporterId: 'team_lead',
      requesterNotificationsEnabled: false, assigneeId: 'l2_specialist',
      linkedOrder: {
        externalOrderId: 'GGX-2026-90008', trackingNumber: 'GGX-2026-90008',
        capturedAt: '2026-06-02T01:00:00Z',
        snapshot: {
          shipmentStatus: 'failed_delivery', bookingDate: '2026-05-31',
          destination: 'Pasig City', serviceType: 'On-Demand',
          deliverySummary: 'Standard delivery', route: 'Metro Manila → Pasig City',
        },
      },
      slaPolicyId: 'sla-standard',
      createdAt: '2026-06-02T01:00:00Z', updatedAt: '2026-06-02T01:00:00Z',
    },

    // PROACTIVE — support opened this FOR the customer and explicitly marked it
    // customer-visible. It is the ONLY agent-created ticket they may see, and the
    // customer app must label it "Opened by GGX Support" (visibility rule 5).
    {
      id: 'tkt-proactive-1', reference: 'HQ-2026-0107', brandId: BRAND, requesterId: 'req-bp-max',
      creatorType: 'agent', sourceChannel: 'proactive', customerVisible: true, accountVisible: true,
      requesterExternalUserId: BP_DEMO_USER, requesterExternalOrgId: BP_DEMO_ORG, customerNotified: true,
      subject: 'We spotted a delay on your Iloilo shipment',
      description: 'Our team noticed this shipment has stalled at the Visayas hub. We have opened this ticket for you and are chasing it.',
      categoryId: 'cat-delivery', subcategoryId: 'sub-del-late', concernType: 'delivery_delay',
      status: 'in_progress', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
      priority: 'normal', source: 'internal', reporterId: 'l1_agent', assigneeId: 'l1_agent',
      requesterNotificationsEnabled: true,
      linkedOrder: {
        externalOrderId: 'GGX-2026-90004', trackingNumber: 'GGX-2026-90004',
        capturedAt: '2026-06-03T02:00:00Z',
        snapshot: {
          shipmentStatus: 'in_transit', bookingDate: '2026-05-30',
          destination: 'Iloilo City', serviceType: 'Standard',
          deliverySummary: 'Standard delivery', route: 'Metro Manila → Iloilo City',
        },
      },
      slaPolicyId: 'sla-standard',
      createdAt: '2026-06-03T02:00:00Z', updatedAt: '2026-06-03T02:05:00Z', firstResponseAt: '2026-06-03T02:05:00Z',
    },
  ];

  const ticketMessages: TicketMessage[] = [
    { id: 'msg-seed-1a', ticketId: 'tkt-seed-1', authorType: 'requester', authorId: 'req-seed-1', authorName: 'Liza Aquino', body: 'My parcel has not moved in three days.', channel: 'web', visibility: 'public', createdAt: '2026-07-08T02:15:00Z' },
    { id: 'msg-seed-1b', ticketId: 'tkt-seed-1', authorType: 'agent', authorId: 'l1_agent', authorName: 'Alex Cruz', body: 'Thanks for reaching out. Could you confirm your tracking number so we can check?', channel: 'web', visibility: 'public', createdAt: '2026-07-08T03:00:00Z' },
    { id: 'msg-seed-2a', ticketId: 'tkt-seed-2', authorType: 'requester', authorId: 'req-seed-2', authorName: 'Marco Reyes', body: 'I have not received my COD remittance for last week.', channel: 'web', visibility: 'public', createdAt: '2026-07-05T01:00:00Z' },
    { id: 'msg-seed-2b', ticketId: 'tkt-seed-2', authorType: 'agent', authorId: 'l2_specialist', authorName: 'Bea Santos', body: 'Your remittance has been reprocessed and should reflect within 24 hours. Marking this resolved.', channel: 'web', visibility: 'public', createdAt: '2026-07-07T08:30:00Z' },
    { id: 'msg-seed-3a', ticketId: 'tkt-seed-3', authorType: 'requester', authorId: 'req-seed-3', authorName: 'Nadia Cruz', body: 'I booked a pickup this morning but no rider came.', channel: 'web', visibility: 'public', createdAt: '2026-07-14T08:00:00Z' },
    { id: 'msg-seed-4a', ticketId: 'tkt-seed-4', authorType: 'requester', authorId: 'req-seed-4', authorName: 'Oliver Tan', body: 'The app closes whenever I tap on My Bookings.', channel: 'web', visibility: 'public', createdAt: '2026-07-14T04:00:00Z' },
    { id: 'msg-seed-4b', ticketId: 'tkt-seed-4', authorType: 'agent', authorId: 'l1_agent', authorName: 'Alex Cruz', body: 'Thanks for reporting. Which phone model and app version are you on?', channel: 'web', visibility: 'public', createdAt: '2026-07-14T04:30:00Z' },
    { id: 'msg-seed-5a', ticketId: 'tkt-seed-5', authorType: 'requester', authorId: 'req-seed-5', authorName: 'Paula Reyes', body: 'I keep getting an error when signing in.', channel: 'web', visibility: 'public', createdAt: '2026-07-13T20:00:00Z' },
    { id: 'msg-seed-6a', ticketId: 'tkt-seed-6', authorType: 'requester', authorId: 'req-seed-6', authorName: 'Quentin Lim', body: 'My parcel arrived damaged and I want to file a claim.', channel: 'web', visibility: 'public', createdAt: '2026-07-14T05:30:00Z' },
    { id: 'msg-seed-7a', ticketId: 'tkt-seed-7', authorType: 'requester', authorId: 'req-seed-3', authorName: 'Nadia Cruz', body: 'A high-value parcel has been missing for over a week.', channel: 'web', visibility: 'public', createdAt: '2026-07-12T09:00:00Z' },
    { id: 'msg-seed-7b', ticketId: 'tkt-seed-7', authorType: 'agent', authorId: 'l2_specialist', authorName: 'Bea Santos', body: 'I am escalating this to our specialist team for a thorough trace.', channel: 'web', visibility: 'public', createdAt: '2026-07-13T09:00:00Z' },
    { id: 'msg-seed-8a', ticketId: 'tkt-seed-8', authorType: 'requester', authorId: 'req-seed-3', authorName: 'Nadia Cruz', body: 'Could you clarify a charge on my latest invoice?', channel: 'web', visibility: 'public', createdAt: '2026-07-13T09:00:00Z' },
    { id: 'msg-seed-8b', ticketId: 'tkt-seed-8', authorType: 'agent', authorId: 'l1_agent', authorName: 'Alex Cruz', body: 'Could you share the invoice number so I can check?', channel: 'web', visibility: 'public', createdAt: '2026-07-13T09:45:00Z' },
    { id: 'msg-seed-9a', ticketId: 'tkt-seed-9', authorType: 'requester', authorId: 'req-seed-7', authorName: 'Grace Fernandez', body: 'Tracking says delivered yesterday but nothing arrived.', channel: 'web', visibility: 'public', createdAt: '2026-07-14T01:00:00Z' },
    { id: 'msg-seed-10a', ticketId: 'tkt-seed-10', authorType: 'requester', authorId: 'req-seed-8', authorName: 'Dominic Ramos', body: 'The rider collected ₱2,000 but my order was ₱1,750.', channel: 'web', visibility: 'public', createdAt: '2026-07-12T03:00:00Z' },
    { id: 'msg-seed-11a', ticketId: 'tkt-seed-11', authorType: 'requester', authorId: 'req-seed-9', authorName: 'Karla Uy', body: 'I got a failed delivery notice with no explanation.', channel: 'web', visibility: 'public', createdAt: '2026-07-13T12:00:00Z' },
    { id: 'msg-seed-12a', ticketId: 'tkt-seed-12', authorType: 'requester', authorId: 'req-seed-10', authorName: 'Ben Alvarez', body: 'My parcel was returned and I was charged a return fee I do not agree with.', channel: 'web', visibility: 'public', createdAt: '2026-07-12T06:00:00Z' },
    { id: 'msg-seed-13a', ticketId: 'tkt-seed-13', authorType: 'requester', authorId: 'req-seed-11', authorName: 'Faye Bautista', body: 'I paid for a shipment but no booking or pickup was scheduled.', channel: 'web', visibility: 'public', createdAt: '2026-07-14T01:30:00Z' },
    { id: 'msg-seed-14a', ticketId: 'tkt-seed-14', authorType: 'requester', authorId: 'req-seed-12', authorName: 'Nico Flores', body: 'The delivery address on my parcel is wrong — please update it.', channel: 'web', visibility: 'public', createdAt: '2026-07-14T02:30:00Z' },
    { id: 'msg-seed-15a', ticketId: 'tkt-seed-15', authorType: 'requester', authorId: 'req-seed-5', authorName: 'Paula Reyes', body: 'Nobody will be home today — can the delivery move to tomorrow?', channel: 'web', visibility: 'public', createdAt: '2026-07-14T03:00:00Z' },
    { id: 'msg-seed-15b', ticketId: 'tkt-seed-15', authorType: 'agent', authorId: 'l1_agent', authorName: 'Alex Cruz', body: 'Rescheduled — the rider will attempt delivery tomorrow morning.', channel: 'web', visibility: 'public', createdAt: '2026-07-14T06:00:00Z' },
    { id: 'msg-seed-16a', ticketId: 'tkt-seed-16', authorType: 'requester', authorId: 'req-seed-6', authorName: 'Quentin Lim', body: 'I want invoices sent to a different address.', channel: 'web', visibility: 'public', createdAt: '2026-07-09T01:00:00Z' },
    { id: 'msg-seed-16b', ticketId: 'tkt-seed-16', authorType: 'agent', authorId: 'l1_agent', authorName: 'Alex Cruz', body: 'Updated your billing email — future invoices will go to the new address.', channel: 'web', visibility: 'public', createdAt: '2026-07-09T23:00:00Z' },
    { id: 'msg-seed-17a', ticketId: 'tkt-seed-17', authorType: 'requester', authorId: 'req-seed-9', authorName: 'Karla Uy', body: 'You closed my last ticket but the parcel never arrived.', channel: 'web', visibility: 'public', createdAt: '2026-07-11T07:00:00Z' },
    { id: 'msg-seed-17b', ticketId: 'tkt-seed-17', authorType: 'agent', authorId: 'l1_agent', authorName: 'Alex Cruz', body: 'Apologies — I have raised a trace with the hub and will update you today.', channel: 'web', visibility: 'public', createdAt: '2026-07-11T08:00:00Z' },
    { id: 'msg-seed-17c', ticketId: 'tkt-seed-17', authorType: 'requester', authorId: 'req-seed-9', authorName: 'Karla Uy', body: 'Still nothing. Please reopen this.', channel: 'web', visibility: 'public', createdAt: '2026-07-13T22:00:00Z' },
    { id: 'msg-seed-18a', ticketId: 'tkt-seed-18', authorType: 'requester', authorId: 'req-seed-3', authorName: 'Nadia Cruz', body: 'Our customer in Davao says tracking has shown In Transit for three days.', channel: 'web', visibility: 'public', createdAt: '2026-07-13T05:00:00Z' },
    { id: 'msg-seed-18b', ticketId: 'tkt-seed-18', authorType: 'agent', authorId: 'l1_agent', authorName: 'Alex Cruz', body: 'Thanks — checking the linehaul status with the Davao hub now.', channel: 'web', visibility: 'public', createdAt: '2026-07-13T06:00:00Z' },

    // Business+ demo user's threads.
    { id: 'msg-bp-1a', ticketId: 'tkt-bp-1', authorType: 'requester', authorId: 'req-bp-max', authorName: 'Max Rodriguez', body: 'The rider marked this as a failed delivery, but our recipient confirms they were on site all afternoon. Please re-attempt.', channel: 'web', visibility: 'public', createdAt: '2026-06-01T09:12:00Z' },
    { id: 'msg-bp-1b', ticketId: 'tkt-bp-1', authorType: 'agent', authorId: 'l1_agent', authorName: 'Alex Cruz', body: 'Thanks for flagging this — we have raised it with the delivery hub and requested a re-attempt. We will update you within 24 hours.', channel: 'web', visibility: 'public', createdAt: '2026-06-01T11:40:00Z' },
    { id: 'msg-bp-1c', ticketId: 'tkt-bp-1', authorType: 'agent', authorId: 'l2_specialist', authorName: 'Bea Santos', body: 'A re-delivery has been scheduled for tomorrow morning and the rider has been asked to call on arrival.', channel: 'web', visibility: 'public', createdAt: '2026-06-02T08:05:00Z' },
    { id: 'msg-bp-2a', ticketId: 'tkt-bp-2', authorType: 'requester', authorId: 'req-bp-max', authorName: 'Max Rodriguez', body: 'This parcel has been in transit for five days with no movement. Can you check with the hub?', channel: 'web', visibility: 'public', createdAt: '2026-06-01T02:30:00Z' },
    { id: 'msg-bp-2b', ticketId: 'tkt-bp-2', authorType: 'agent', authorId: 'l1_agent', authorName: 'Alex Cruz', body: 'We have raised a trace with the Visayas hub and are waiting on their response. We will come back to you as soon as we hear.', channel: 'web', visibility: 'public', createdAt: '2026-06-01T06:15:00Z' },
    { id: 'msg-bp-3a', ticketId: 'tkt-bp-3', authorType: 'requester', authorId: 'req-bp-max', authorName: 'Max Rodriguez', body: 'The COD remitted for this order is short by ₱1,200 against what we booked.', channel: 'web', visibility: 'public', createdAt: '2026-05-29T04:00:00Z' },
    { id: 'msg-bp-3b', ticketId: 'tkt-bp-3', authorType: 'agent', authorId: 'l1_agent', authorName: 'Alex Cruz', body: 'You were right — a partial remittance was posted in error. The ₱1,200 balance has been included in your next settlement run.', channel: 'web', visibility: 'public', createdAt: '2026-05-30T07:20:00Z' },
    { id: 'msg-bp-4a', ticketId: 'tkt-bp-4', authorType: 'requester', authorId: 'req-bp-max', authorName: 'Max Rodriguez', body: 'Could you break down the fuel surcharge line on last month’s invoice?', channel: 'web', visibility: 'public', createdAt: '2026-05-20T01:10:00Z' },
    { id: 'msg-bp-4b', ticketId: 'tkt-bp-4', authorType: 'agent', authorId: 'l1_agent', authorName: 'Alex Cruz', body: 'Sent the itemised breakdown to your billing contact. Closing this out — reopen any time if you need more detail.', channel: 'web', visibility: 'public', createdAt: '2026-05-21T03:45:00Z' },
    { id: 'msg-bp-5a', ticketId: 'tkt-bp-5', authorType: 'requester', authorId: 'req-bp-max', authorName: 'Max Rodriguez', body: 'The parcel arrived with a crushed corner and the contents are damaged.', channel: 'web', visibility: 'public', createdAt: '2026-05-15T05:00:00Z' },

    // The internal investigation's thread is agent-to-agent. It never reaches the
    // customer, because the TICKET is not customer-visible.
    { id: 'msg-int-1a', ticketId: 'tkt-internal-1', authorType: 'agent', authorId: 'team_lead', authorName: 'Carlo Reyes', body: 'Opening an investigation into repeat mis-scans on the Pasig route.', channel: 'web', visibility: 'public', createdAt: '2026-06-02T01:00:00Z' },

    // The proactive ticket opens with SUPPORT speaking first — the customer never
    // wrote anything, which is exactly why it must be labelled as ours.
    { id: 'msg-pro-1a', ticketId: 'tkt-proactive-1', authorType: 'agent', authorId: 'l1_agent', authorName: 'Alex Cruz', body: 'Our team noticed this shipment has stalled at the Visayas hub. We have opened this ticket for you and are already chasing it — no action needed on your side.', channel: 'web', visibility: 'public', createdAt: '2026-06-03T02:05:00Z' },
  ];

  // Internal notes — agent-only, never surfaced to requesters (product rule #5).
  const internalNotes: InternalNote[] = [
    { id: 'note-seed-4a', ticketId: 'tkt-seed-4', agentId: 'l1_agent', agentName: 'Alex Cruz', body: 'Likely the crash from the 3.2.1 release. Waiting on device details before flagging to Tech.', createdAt: '2026-07-14T04:35:00Z' },
    { id: 'note-seed-7a', ticketId: 'tkt-seed-7', agentId: 'l2_specialist', agentName: 'Bea Santos', body: 'Trace opened with the hub. High-value — keep the requester updated daily.', createdAt: '2026-07-13T09:10:00Z' },
    // On a CUSTOMER-VISIBLE Business+ ticket — the ticket is visible, the note is
    // not. This is what the leak tests assert on.
    { id: 'note-bp-1a', ticketId: 'tkt-bp-1', agentId: 'l1_agent', agentName: 'Alex Cruz', body: 'Hub confirms rider mis-scanned. Escalating to Claims for a goodwill credit — do not disclose to the customer.', createdAt: '2026-06-01T12:02:00Z' },
    { id: 'note-int-1a', ticketId: 'tkt-internal-1', agentId: 'team_lead', agentName: 'Carlo Reyes', body: 'Third mis-scan this month on this route. Escalate to ops leadership if it recurs.', createdAt: '2026-06-02T01:05:00Z' },
  ];

  const statusEvents: StatusEvent[] = [
    { id: 'se-seed-1a', ticketId: 'tkt-seed-1', actor: 'system', toStatus: 'new', timestamp: '2026-07-08T02:15:00Z' },
    { id: 'se-seed-1b', ticketId: 'tkt-seed-1', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-08T02:15:05Z' },
    { id: 'se-seed-1c', ticketId: 'tkt-seed-1', actor: 'l1_agent', fromStatus: 'open', toStatus: 'on_hold', note: 'Waiting for requester', timestamp: '2026-07-08T03:00:00Z' },
    { id: 'se-seed-2a', ticketId: 'tkt-seed-2', actor: 'system', toStatus: 'new', timestamp: '2026-07-05T01:00:00Z' },
    { id: 'se-seed-2b', ticketId: 'tkt-seed-2', actor: 'l2_specialist', fromStatus: 'in_progress', toStatus: 'resolved', timestamp: '2026-07-07T08:30:00Z' },

    { id: 'se-seed-3a', ticketId: 'tkt-seed-3', actor: 'requester', toStatus: 'new', timestamp: '2026-07-14T08:00:00Z' },
    { id: 'se-seed-3b', ticketId: 'tkt-seed-3', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-14T08:00:01Z' },

    { id: 'se-seed-4a', ticketId: 'tkt-seed-4', actor: 'requester', toStatus: 'new', timestamp: '2026-07-14T04:00:00Z' },
    { id: 'se-seed-4b', ticketId: 'tkt-seed-4', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-14T04:00:01Z' },
    { id: 'se-seed-4c', ticketId: 'tkt-seed-4', actor: 'l1_agent', fromStatus: 'open', toStatus: 'in_progress', timestamp: '2026-07-14T04:30:00Z' },

    { id: 'se-seed-5a', ticketId: 'tkt-seed-5', actor: 'requester', toStatus: 'new', timestamp: '2026-07-13T20:00:00Z' },
    { id: 'se-seed-5b', ticketId: 'tkt-seed-5', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-13T20:00:01Z' },

    { id: 'se-seed-6a', ticketId: 'tkt-seed-6', actor: 'requester', toStatus: 'new', timestamp: '2026-07-14T05:30:00Z' },
    { id: 'se-seed-6b', ticketId: 'tkt-seed-6', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-14T05:30:01Z' },

    { id: 'se-seed-7a', ticketId: 'tkt-seed-7', actor: 'requester', toStatus: 'new', timestamp: '2026-07-12T09:00:00Z' },
    { id: 'se-seed-7b', ticketId: 'tkt-seed-7', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-12T09:00:01Z' },
    { id: 'se-seed-7c', ticketId: 'tkt-seed-7', actor: 'l2_specialist', fromStatus: 'open', toStatus: 'in_progress', timestamp: '2026-07-12T10:00:00Z' },

    { id: 'se-seed-8a', ticketId: 'tkt-seed-8', actor: 'requester', toStatus: 'new', timestamp: '2026-07-13T09:00:00Z' },
    { id: 'se-seed-8b', ticketId: 'tkt-seed-8', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-13T09:00:01Z' },
    { id: 'se-seed-8c', ticketId: 'tkt-seed-8', actor: 'l1_agent', fromStatus: 'open', toStatus: 'in_progress', timestamp: '2026-07-13T09:45:00Z' },
    { id: 'se-seed-8d', ticketId: 'tkt-seed-8', actor: 'l1_agent', fromStatus: 'in_progress', toStatus: 'on_hold', note: 'Waiting for requester', timestamp: '2026-07-13T09:46:00Z' },

    { id: 'se-seed-9a', ticketId: 'tkt-seed-9', actor: 'requester', toStatus: 'new', timestamp: '2026-07-14T01:00:00Z' },
    { id: 'se-seed-9b', ticketId: 'tkt-seed-9', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-14T01:00:01Z' },
    { id: 'se-seed-10a', ticketId: 'tkt-seed-10', actor: 'requester', toStatus: 'new', timestamp: '2026-07-12T03:00:00Z' },
    { id: 'se-seed-10b', ticketId: 'tkt-seed-10', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-12T03:00:01Z' },
    { id: 'se-seed-10c', ticketId: 'tkt-seed-10', actor: 'l2_specialist', fromStatus: 'open', toStatus: 'in_progress', timestamp: '2026-07-12T04:00:00Z' },
    { id: 'se-seed-10d', ticketId: 'tkt-seed-10', actor: 'l2_specialist', fromStatus: 'in_progress', toStatus: 'on_hold', note: 'Waiting for third party', timestamp: '2026-07-13T02:00:00Z' },
    { id: 'se-seed-11a', ticketId: 'tkt-seed-11', actor: 'requester', toStatus: 'new', timestamp: '2026-07-13T12:00:00Z' },
    { id: 'se-seed-11b', ticketId: 'tkt-seed-11', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-13T12:00:01Z' },
    { id: 'se-seed-12a', ticketId: 'tkt-seed-12', actor: 'requester', toStatus: 'new', timestamp: '2026-07-12T06:00:00Z' },
    { id: 'se-seed-12b', ticketId: 'tkt-seed-12', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-12T06:00:01Z' },
    { id: 'se-seed-13a', ticketId: 'tkt-seed-13', actor: 'requester', toStatus: 'new', timestamp: '2026-07-14T01:30:00Z' },
    { id: 'se-seed-13b', ticketId: 'tkt-seed-13', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-14T01:30:01Z' },
    // tkt-seed-14 has only ever been created — it is still New (not yet reviewed).
    { id: 'se-seed-14a', ticketId: 'tkt-seed-14', actor: 'requester', toStatus: 'new', timestamp: '2026-07-14T02:30:00Z' },

    { id: 'se-seed-15a', ticketId: 'tkt-seed-15', actor: 'requester', toStatus: 'new', timestamp: '2026-07-14T03:00:00Z' },
    { id: 'se-seed-15b', ticketId: 'tkt-seed-15', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-14T03:00:01Z' },
    { id: 'se-seed-15c', ticketId: 'tkt-seed-15', actor: 'l1_agent', fromStatus: 'open', toStatus: 'in_progress', timestamp: '2026-07-14T03:20:00Z' },
    { id: 'se-seed-15d', ticketId: 'tkt-seed-15', actor: 'l1_agent', fromStatus: 'in_progress', toStatus: 'resolved', timestamp: '2026-07-14T06:00:00Z' },

    { id: 'se-seed-16a', ticketId: 'tkt-seed-16', actor: 'requester', toStatus: 'new', timestamp: '2026-07-09T01:00:00Z' },
    { id: 'se-seed-16b', ticketId: 'tkt-seed-16', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-09T01:00:01Z' },
    { id: 'se-seed-16c', ticketId: 'tkt-seed-16', actor: 'l1_agent', fromStatus: 'open', toStatus: 'resolved', timestamp: '2026-07-09T23:00:00Z' },
    { id: 'se-seed-16d', ticketId: 'tkt-seed-16', actor: 'system', fromStatus: 'resolved', toStatus: 'closed', note: 'Auto-closed after 24h with no reply', timestamp: '2026-07-10T05:00:00Z' },

    { id: 'se-seed-17a', ticketId: 'tkt-seed-17', actor: 'requester', toStatus: 'new', timestamp: '2026-07-11T07:00:00Z' },
    { id: 'se-seed-17b', ticketId: 'tkt-seed-17', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-11T07:00:01Z' },
    { id: 'se-seed-17c', ticketId: 'tkt-seed-17', actor: 'l1_agent', fromStatus: 'open', toStatus: 'in_progress', timestamp: '2026-07-11T08:00:00Z' },
    { id: 'se-seed-17d', ticketId: 'tkt-seed-17', actor: 'l1_agent', fromStatus: 'in_progress', toStatus: 'resolved', timestamp: '2026-07-12T10:00:00Z' },
    { id: 'se-seed-17e', ticketId: 'tkt-seed-17', actor: 'requester', fromStatus: 'resolved', toStatus: 'in_progress', note: 'Requester replied after resolution', timestamp: '2026-07-13T22:00:00Z' },

    { id: 'se-seed-18a', ticketId: 'tkt-seed-18', actor: 'requester', toStatus: 'new', timestamp: '2026-07-13T05:00:00Z' },
    { id: 'se-seed-18b', ticketId: 'tkt-seed-18', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-13T05:00:01Z' },

    { id: 'se-bp-1a', ticketId: 'tkt-bp-1', actor: 'requester', toStatus: 'new', timestamp: '2026-06-01T09:12:00Z' },
    { id: 'se-bp-1b', ticketId: 'tkt-bp-1', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-06-01T09:12:01Z' },
    { id: 'se-bp-1c', ticketId: 'tkt-bp-1', actor: 'l1_agent', fromStatus: 'open', toStatus: 'in_progress', timestamp: '2026-06-01T11:40:00Z' },
    { id: 'se-bp-2a', ticketId: 'tkt-bp-2', actor: 'requester', toStatus: 'new', timestamp: '2026-06-01T02:30:00Z' },
    { id: 'se-bp-2b', ticketId: 'tkt-bp-2', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-06-01T02:30:01Z' },
    { id: 'se-bp-2c', ticketId: 'tkt-bp-2', actor: 'l1_agent', fromStatus: 'open', toStatus: 'on_hold', note: 'Waiting for third party', timestamp: '2026-06-01T06:15:00Z' },
    { id: 'se-bp-3a', ticketId: 'tkt-bp-3', actor: 'requester', toStatus: 'new', timestamp: '2026-05-29T04:00:00Z' },
    { id: 'se-bp-3b', ticketId: 'tkt-bp-3', actor: 'l1_agent', fromStatus: 'in_progress', toStatus: 'resolved', timestamp: '2026-05-30T07:22:00Z' },
    { id: 'se-bp-4a', ticketId: 'tkt-bp-4', actor: 'requester', toStatus: 'new', timestamp: '2026-05-20T01:10:00Z' },
    { id: 'se-bp-4b', ticketId: 'tkt-bp-4', actor: 'l1_agent', fromStatus: 'in_progress', toStatus: 'closed', timestamp: '2026-05-21T03:45:00Z' },
    { id: 'se-bp-5a', ticketId: 'tkt-bp-5', actor: 'requester', toStatus: 'new', timestamp: '2026-05-15T05:00:00Z' },
    { id: 'se-bp-5b', ticketId: 'tkt-bp-5', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-05-15T05:00:01Z' },

    { id: 'se-int-1a', ticketId: 'tkt-internal-1', actor: 'team_lead', toStatus: 'new', note: 'Internal ticket created', timestamp: '2026-06-02T01:00:00Z' },
    { id: 'se-int-1b', ticketId: 'tkt-internal-1', actor: 'system', fromStatus: 'new', toStatus: 'in_progress', timestamp: '2026-06-02T01:00:01Z' },

    { id: 'se-pro-1a', ticketId: 'tkt-proactive-1', actor: 'l1_agent', toStatus: 'new', note: 'Proactive ticket opened for the customer', timestamp: '2026-06-03T02:00:00Z' },
    { id: 'se-pro-1b', ticketId: 'tkt-proactive-1', actor: 'l1_agent', fromStatus: 'new', toStatus: 'in_progress', timestamp: '2026-06-03T02:05:00Z' },
  ];

  const assignments: Assignment[] = [
    { id: 'asg-seed-4a', ticketId: 'tkt-seed-4', actor: 'l1_agent', toAssigneeId: 'l1_agent', toTeamId: 'team-cs', timestamp: '2026-07-14T04:20:00Z' },
    { id: 'asg-seed-5a', ticketId: 'tkt-seed-5', actor: 'l1_agent', toAssigneeId: 'l1_agent', toTeamId: 'team-cs', timestamp: '2026-07-13T20:05:00Z' },
    { id: 'asg-seed-15a', ticketId: 'tkt-seed-15', actor: 'l1_agent', toAssigneeId: 'l1_agent', toTeamId: 'team-cs', timestamp: '2026-07-14T03:20:00Z' },
    { id: 'asg-seed-10a', ticketId: 'tkt-seed-10', actor: 'l2_specialist', toAssigneeId: 'l2_specialist', toTeamId: 'team-payments', timestamp: '2026-07-12T04:00:00Z' },
    { id: 'asg-seed-16a', ticketId: 'tkt-seed-16', actor: 'l1_agent', toAssigneeId: 'l1_agent', toTeamId: 'team-cs', timestamp: '2026-07-09T01:30:00Z' },
    { id: 'asg-seed-17a', ticketId: 'tkt-seed-17', actor: 'l1_agent', toAssigneeId: 'l1_agent', toTeamId: 'team-cs', timestamp: '2026-07-11T08:00:00Z' },
    { id: 'asg-seed-7a', ticketId: 'tkt-seed-7', actor: 'team_lead', fromAssigneeId: undefined, toAssigneeId: 'l2_specialist', fromTeamId: 'team-claims', toTeamId: 'team-claims', timestamp: '2026-07-13T09:00:00Z' },
    { id: 'asg-bp-1a', ticketId: 'tkt-bp-1', actor: 'team_lead', toAssigneeId: 'l2_specialist', fromTeamId: 'team-cs', toTeamId: 'team-claims', timestamp: '2026-06-01T12:02:00Z' },
    { id: 'asg-bp-2a', ticketId: 'tkt-bp-2', actor: 'l1_agent', toAssigneeId: 'l1_agent', toTeamId: 'team-cs', timestamp: '2026-06-01T06:15:00Z' },
    { id: 'asg-int-1a', ticketId: 'tkt-internal-1', actor: 'team_lead', toAssigneeId: 'l2_specialist', toTeamId: 'team-claims', timestamp: '2026-06-02T01:00:00Z' },
    { id: 'asg-pro-1a', ticketId: 'tkt-proactive-1', actor: 'l1_agent', toAssigneeId: 'l1_agent', toTeamId: 'team-cs', timestamp: '2026-06-03T02:00:00Z' },
  ];

  const escalations: Escalation[] = [
    { id: 'esc-seed-7a', ticketId: 'tkt-seed-7', actor: 'team_lead', direction: 'escalate', fromTier: 'L1', toTier: 'L2', fromTeamId: 'team-claims', toTeamId: 'team-claims', reason: 'high_value', note: 'High-value parcel missing over a week — needs specialist trace.', timestamp: '2026-07-13T09:00:00Z' },
    { id: 'esc-bp-1a', ticketId: 'tkt-bp-1', actor: 'team_lead', direction: 'escalate', fromTier: 'L1', toTier: 'L2', fromTeamId: 'team-cs', toTeamId: 'team-claims', reason: 'complex_case', note: 'Rider mis-scan confirmed by the hub — Claims to handle the goodwill credit.', timestamp: '2026-06-01T12:02:00Z' },
  ];

  const requesterAccess: RequesterAccess[] = [
    { ticketId: 'tkt-seed-1', accessToken: 'demo-token-parcel', issuedAt: '2026-07-08T02:15:00Z' },
    { ticketId: 'tkt-seed-2', accessToken: 'demo-token-cod', issuedAt: '2026-07-05T01:00:00Z' },
    { ticketId: 'tkt-seed-4', accessToken: 'demo-token-app', issuedAt: '2026-07-14T04:00:00Z' },
    // Nadia Cruz (req-seed-3) — the `customer` demo identity.
    { ticketId: 'tkt-seed-3', accessToken: 'demo-token-pickup', issuedAt: '2026-07-14T08:00:00Z' },
    { ticketId: 'tkt-seed-7', accessToken: 'demo-token-lost', issuedAt: '2026-07-12T09:00:00Z' },
    { ticketId: 'tkt-seed-8', accessToken: 'demo-token-invoice', issuedAt: '2026-07-13T09:00:00Z' },
    { ticketId: 'tkt-seed-18', accessToken: 'demo-token-bporder', issuedAt: '2026-07-13T05:00:00Z' },
    // The Business+ user's tickets — the portal links their app hands off to.
    { ticketId: 'tkt-bp-1', accessToken: 'demo-token-bp1', issuedAt: '2026-06-01T09:12:00Z' },
    { ticketId: 'tkt-bp-2', accessToken: 'demo-token-bp2', issuedAt: '2026-06-01T02:30:00Z' },
    { ticketId: 'tkt-bp-3', accessToken: 'demo-token-bp3', issuedAt: '2026-05-29T04:00:00Z' },
    { ticketId: 'tkt-bp-4', accessToken: 'demo-token-bp4', issuedAt: '2026-05-20T01:10:00Z' },
    { ticketId: 'tkt-bp-5', accessToken: 'demo-token-bp5', issuedAt: '2026-05-15T05:00:00Z' },
    { ticketId: 'tkt-proactive-1', accessToken: 'demo-token-pro1', issuedAt: '2026-06-03T02:00:00Z' },
    // NOTE: tkt-internal-1 has NO access token. An internal ticket grants no
    // portal access, so there is nothing for a customer to open.
  ];

  // ── Quality reviews ───────────────────────────────────────────────────────
  // One COMPLETED supervisor review (feeds the "Completed" column and the score
  // filter) and one DRAFT (the "In progress" column). Every other assigned ticket
  // falls into "To review". Carlo Reyes (team_lead) is the reviewer in both.
  //
  // Neither carries `reviewType` — they stand in for records written before the
  // field existed, and must keep reading as supervisor reviews (`reviewTypeOf`).
  //
  // A third record is an AI review on a ticket with NO supervisor review, so the
  // demo shows the two types coexisting: the ticket stays in "To review" and a
  // lead can still start their own review of it.
  const completedResponses = {
    greeting: 'yes', empathy: 'yes', clarity: 'yes', respectful_tone: 'yes',
    reviewed_context: 'yes', used_evidence: 'yes', took_ownership: 'yes', accurate_diagnosis: 'yes',
    followed_process: 'yes', complete_resolution: 'yes', set_expectations: 'na', timely_handling: 'no',
    verified_identity: 'yes', data_privacy: 'yes', no_unauthorized_promises: 'yes',
  } as const;

  const aiResponses = {
    greeting: 'yes', empathy: 'yes', clarity: 'yes', respectful_tone: 'yes',
    reviewed_context: 'yes', used_evidence: 'yes', took_ownership: 'yes', accurate_diagnosis: 'yes',
    followed_process: 'yes', complete_resolution: 'yes', set_expectations: 'no', timely_handling: 'yes',
    verified_identity: 'yes', data_privacy: 'yes', no_unauthorized_promises: 'yes',
  } as const;

  // Rationales for the seeded AI review — every criterion carries one, because an
  // AI score a supervisor cannot check against the conversation is not reviewable.
  const aiRationales: Record<string, string> = {
    greeting: 'Opened with a branded greeting and the ticket reference.',
    empathy: 'Acknowledged the delay in remittance and its cash-flow impact.',
    clarity: 'Explained the remittance cycle without internal jargon.',
    respectful_tone: 'Tone stayed courteous across the whole thread.',
    reviewed_context: 'Read the linked order before the first reply.',
    used_evidence: 'Quoted the remittance record to explain the amount.',
    took_ownership: 'Followed the case through to the payout confirmation.',
    accurate_diagnosis: 'Correctly identified a scheduling gap, not a shortfall.',
    followed_process: 'Applied the standard remittance-query steps in order.',
    complete_resolution: 'Confirmed the payout and closed with the reference.',
    set_expectations: 'Did not state when the next remittance would land.',
    timely_handling: 'First reply well inside the target window.',
    verified_identity: 'Confirmed the requester against the account before details.',
    data_privacy: 'Shared no card or bank detail beyond the masked reference.',
    no_unauthorized_promises: 'Made no commitment outside the published schedule.',
  };

  const aiFindings: Record<string, AiFinding> = Object.fromEntries(
    Object.entries(aiResponses).map(([id, value]) => [id, { value, rationale: aiRationales[id] }]),
  );

  const qualityReviews: QualityReview[] = [
    {
      // tkt-bp-3 — Alex Cruz (l1_agent) resolved a COD shortfall correctly, but a
      // little slowly. Strong review with one N/A and one No; no zero-tolerance
      // finding. Score is FROZEN against rubric v1 at submission.
      id: 'qr-seed-1', ticketId: 'tkt-bp-3', agentId: 'l1_agent', reviewerId: 'team_lead',
      status: 'submitted', rubricVersion: 'v1',
      responses: { ...completedResponses },
      feedback: {
        whatWentWell: 'Spotted the partial remittance quickly and explained the correction clearly.',
        areasForImprovement: 'First response took longer than our target — pick these up sooner.',
        reviewerComments: 'Solid handling overall. Good, empathetic close.',
      },
      score: computeReviewScore({ ...completedResponses }),
      createdAt: '2026-06-03T01:00:00Z', updatedAt: '2026-06-03T01:20:00Z', submittedAt: '2026-06-03T01:20:00Z',
    },
    {
      // tkt-seed-7 — Bea Santos (l2_specialist), escalated high-value lost parcel.
      // A draft the lead has started but not finished (required lines still open).
      id: 'qr-seed-2', ticketId: 'tkt-seed-7', agentId: 'l2_specialist', reviewerId: 'team_lead',
      status: 'draft', rubricVersion: 'v1',
      responses: { empathy: 'yes', respectful_tone: 'yes', reviewed_context: 'yes', used_evidence: 'yes' },
      feedback: {
        whatWentWell: 'Opened a hub trace promptly and kept the internal note trail tidy.',
        areasForImprovement: '',
        reviewerComments: '',
      },
      createdAt: '2026-07-14T02:00:00Z', updatedAt: '2026-07-14T02:10:00Z',
    },
    {
      // tkt-bp-4 — Alex Cruz (l1_agent), a closed Business+ remittance query. An
      // AI review with no supervisor review beside it. `reviewerId` is the
      // placeholder `ai`: the record has no human owner. It does NOT take the
      // ticket out of the supervisor queue, and a lead may still review it.
      // It scored 96% — comfortably above the 80% threshold — so no supervisor
      // review is REQUIRED, which is precisely the case that must still leave the
      // ticket open to one.
      id: 'qr-seed-3', ticketId: 'tkt-bp-4', agentId: 'l1_agent', reviewerId: 'ai',
      reviewType: 'ai', status: 'submitted', rubricVersion: 'v1',
      responses: { ...aiResponses },
      feedback: {
        whatWentWell: 'Confirmed the remittance schedule against the linked order before replying.',
        areasForImprovement: 'The closing reply left the next remittance date implicit.',
        reviewerComments: '',
      },
      score: computeReviewScore({ ...aiResponses }),
      ai: {
        provider: 'fake', model: FAKE_AI_MODEL, promptVersion: 'v1',
        status: 'succeeded',
        requestedAt: '2026-07-14T04:00:00Z', completedAt: '2026-07-14T04:00:00Z',
        findings: aiFindings,
      },
      supervisorReviewRequired: false,
      thresholdPercent: 80,
      createdAt: '2026-07-14T04:00:00Z', updatedAt: '2026-07-14T04:00:00Z', submittedAt: '2026-07-14T04:00:00Z',
    },
  ];

  const notifications: Notification[] = [
    { id: 'ntf-seed-1', recipientId: 'l1_agent', event: 'requester_replied', title: 'New reply from Liza Aquino', ticketId: 'tkt-seed-1', ticketRef: 'HQ-2026-0001', emailed: false, read: false, createdAt: '2026-07-14T07:30:00Z' },
    { id: 'ntf-seed-2', recipientId: 'l1_agent', event: 'ticket_assigned', title: 'Assigned: Cannot log in to my account', ticketId: 'tkt-seed-5', ticketRef: 'HQ-2026-0005', emailed: false, read: false, createdAt: '2026-07-13T20:05:00Z' },
    { id: 'ntf-seed-3', recipientId: 'l2_specialist', event: 'ticket_escalated', title: 'Escalated: Lost parcel — high value', ticketId: 'tkt-seed-7', ticketRef: 'HQ-2026-0007', emailed: false, read: true, createdAt: '2026-07-13T09:00:00Z' },
  ];
  const notificationPrefs: { muted: NotificationEvent[] } = { muted: [] };

  const businessPlusOrgs: BusinessPlusOrg[] = [
    { externalOrgId: 'bp-org-acme', name: 'Acme Retail Corp' },
    { externalOrgId: 'bp-org-zenith', name: 'Zenith Trading' },
  ];

  const businessPlusUsers: BusinessPlusUser[] = [
    { externalUserId: 'bp-user-nadia', externalOrgId: 'bp-org-acme', name: 'Nadia Cruz', email: 'nadia.cruz@example.com' },
    { externalUserId: 'bp-user-omar', externalOrgId: 'bp-org-zenith', name: 'Omar Villanueva', email: 'omar.v@example.com' },
  ];

  const businessPlusOrders: BusinessPlusOrderRecord[] = [
    {
      externalOrderId: 'BP-ORD-7001', externalOrgId: 'bp-org-acme',
      trackingNumber: 'Q7PL-2MRX-J90A', shipmentStatus: 'out_for_delivery',
      bookingDate: '2026-07-12T02:00:00Z',
      senderSummary: 'Acme Retail — Warehouse 3', recipientSummary: 'J. Ramos, Makati',
      destination: 'Makati City',
    },
    {
      externalOrderId: 'BP-ORD-7002', externalOrgId: 'bp-org-acme',
      trackingNumber: 'H3KD-8WTF-B45N', shipmentStatus: 'failed_delivery',
      bookingDate: '2026-07-10T06:30:00Z',
      senderSummary: 'Acme Retail — Warehouse 1', recipientSummary: 'C. Uy, Cebu City',
      destination: 'Cebu City',
    },
    {
      // tkt-seed-18's snapshot was captured while this was still in_transit; the
      // live record has since moved to delivered.
      externalOrderId: 'BP-ORD-7003', externalOrgId: 'bp-org-acme',
      trackingNumber: 'Y6TN-4QSV-D28E', shipmentStatus: 'delivered',
      bookingDate: '2026-07-08T01:15:00Z',
      senderSummary: 'Acme Retail — Warehouse 3', recipientSummary: 'M. Santos, Davao',
      destination: 'Davao City',
    },
    {
      externalOrderId: 'BP-ORD-7004', externalOrgId: 'bp-org-acme',
      trackingNumber: 'R9GC-5ZLH-K73P', shipmentStatus: 'booked',
      bookingDate: '2026-07-14T03:45:00Z',
      senderSummary: 'Acme Retail — Warehouse 2', recipientSummary: 'A. Reyes, Pasig',
      destination: 'Pasig City',
    },
    // ── GGX Business+ handoff compatibility (M23) — Business+ deep-links real
    // OMS orders (`/contact?order=GGX-2026-90008`) whose stable id IS the GGX
    // tracking number. Additive; the BP-ORD-* set above is untouched.
    {
      externalOrderId: 'GGX-2026-90008', externalOrgId: 'bp-org-acme',
      trackingNumber: 'GGX-2026-90008', shipmentStatus: 'failed_delivery',
      bookingDate: '2026-05-31T02:00:00Z',
      senderSummary: 'Acme Corporation', recipientSummary: 'Horizon Publishing Co., Pasig',
      destination: 'Pasig City',
    },
    {
      externalOrderId: 'GGX-2026-90004', externalOrgId: 'bp-org-acme',
      trackingNumber: 'GGX-2026-90004', shipmentStatus: 'in_transit',
      bookingDate: '2026-05-30T02:00:00Z',
      senderSummary: 'Acme Corporation', recipientSummary: 'Vertex Logistics Corp., Iloilo',
      destination: 'Iloilo City',
    },
    {
      externalOrderId: 'GGX-2026-90001', externalOrgId: 'bp-org-acme',
      trackingNumber: 'GGX-2026-90001', shipmentStatus: 'picked_up',
      bookingDate: '2026-05-29T02:00:00Z',
      senderSummary: 'Acme Corporation', recipientSummary: 'Bluewave E-Commerce, Davao',
      destination: 'Davao City',
    },
    {
      externalOrderId: 'GGX-2026-90009', externalOrgId: 'bp-org-acme',
      trackingNumber: 'GGX-2026-90009', shipmentStatus: 'in_transit',
      bookingDate: '2026-05-31T02:00:00Z',
      senderSummary: 'Acme Luzon', recipientSummary: 'Meridian Health Corp., Quezon City',
      destination: 'Quezon City',
    },
    {
      externalOrderId: 'GGX-2024-89240', externalOrgId: 'bp-org-acme',
      trackingNumber: 'GGX-2024-89240', shipmentStatus: 'delivered',
      bookingDate: '2026-05-18T02:00:00Z',
      senderSummary: 'Acme Corporation', recipientSummary: 'TechStart Solutions, Makati',
      destination: 'Makati City',
    },
    {
      externalOrderId: 'BP-ORD-8001', externalOrgId: 'bp-org-zenith',
      trackingNumber: 'V2WM-7JXB-F61S', shipmentStatus: 'in_transit',
      bookingDate: '2026-07-11T09:00:00Z',
      senderSummary: 'Zenith Trading — Main Hub', recipientSummary: 'R. Lim, Iloilo',
      destination: 'Iloilo City',
    },
    {
      externalOrderId: 'BP-ORD-8002', externalOrgId: 'bp-org-zenith',
      trackingNumber: 'G8FE-1CYD-N50U', shipmentStatus: 'returned',
      bookingDate: '2026-07-09T04:20:00Z',
      senderSummary: 'Zenith Trading — Main Hub', recipientSummary: 'T. Ong, Baguio',
      destination: 'Baguio City',
    },
  ];

  return {
    requesters,
    tickets,
    ticketMessages,
    internalNotes,
    statusEvents,
    assignments,
    escalations,
    requesterAccess,
    attachments: [],
    qualityReviews,
    reviewConfig: { ...DEFAULT_REVIEW_CONFIG },
    // Running reference counter, seeded past the demo tickets.
    referenceSeq: 107,
    notifications,
    notificationPrefs,
    businessPlusOrgs,
    businessPlusUsers,
    businessPlusOrders,
  };
}

/** A fresh, isolated copy of the seed. */
export function createSeedState(): SeedState {
  return structuredClone(seed());
}
