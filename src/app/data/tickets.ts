// Ticket mock state (module state, mutated by ticketService). Components must
// access this only through services.
//
// The seed deliberately covers every state the UI has to render: all six core
// statuses, both an external and an internal hold reason, an escalated ticket, a
// reopened one, tickets with and without a GGX shipment, all three priorities, and
// on-track / at-risk / breached SLA. Access tokens are opaque simulated strings.
import type {
  Assignment,
  Escalation,
  InternalNote,
  Requester,
  RequesterAccess,
  StatusEvent,
  Ticket,
  TicketMessage,
} from '../models/ticket';

const BRAND = 'ggx';

export const requesters: Requester[] = [
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
];

export const tickets: Ticket[] = [
  {
    id: 'tkt-seed-1', reference: 'HQ-2026-0001', brandId: BRAND, requesterId: 'req-seed-1',
    subject: 'Where is my parcel?', description: 'My parcel has not moved in three days.',
    categoryId: 'cat-delivery', subcategoryId: 'sub-del-status', concernType: 'delivery_delay',
    status: 'on_hold', holdReason: 'waiting_requester',
    escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'normal', source: 'web', relatedTransactionId: 'TXN-2001', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-08T02:15:00Z', updatedAt: '2026-07-09T06:40:00Z', firstResponseAt: '2026-07-08T03:00:00Z',
  },
  {
    id: 'tkt-seed-2', reference: 'HQ-2026-0002', brandId: BRAND, requesterId: 'req-seed-2',
    subject: 'COD remittance not received', description: 'I have not received my COD remittance for last week.',
    categoryId: 'cat-cod', subcategoryId: 'sub-cod-remit', concernType: 'remittance_concern',
    status: 'resolved', escalationState: 'none', supportTier: 'L2', teamId: 'team-payments',
    priority: 'high', source: 'web', relatedTransactionId: 'TXN-2002', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-05T01:00:00Z', updatedAt: '2026-07-07T08:30:00Z', firstResponseAt: '2026-07-05T02:10:00Z', resolvedAt: '2026-07-07T08:30:00Z',
  },
  // Unassigned, team-cs, fresh — first-response on track.
  {
    id: 'tkt-seed-3', reference: 'HQ-2026-0003', brandId: BRAND, requesterId: 'req-seed-3',
    subject: 'Rider did not arrive for pickup', description: 'I booked a pickup this morning but no rider came.',
    categoryId: 'cat-pickup', subcategoryId: 'sub-pu-missed', concernType: 'pickup_issue',
    status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'normal', source: 'web', relatedTransactionId: 'TXN-2003', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-14T08:00:00Z', updatedAt: '2026-07-14T08:00:00Z',
  },
  // Assigned to l1_agent, in progress — first-response met, resolution on track.
  {
    id: 'tkt-seed-4', reference: 'HQ-2026-0004', brandId: BRAND, requesterId: 'req-seed-4',
    subject: 'App crashes when opening bookings', description: 'The app closes whenever I tap on My Bookings.',
    categoryId: 'cat-technical', subcategoryId: 'sub-tech-app', concernType: 'booking_issue',
    status: 'in_progress', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'high', source: 'web', assigneeId: 'l1_agent', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-14T04:00:00Z', updatedAt: '2026-07-14T04:30:00Z', firstResponseAt: '2026-07-14T04:30:00Z',
  },
  // Assigned to l1_agent, open, no first response yet — first-response BREACHED.
  {
    id: 'tkt-seed-5', reference: 'HQ-2026-0005', brandId: BRAND, requesterId: 'req-seed-5',
    subject: 'Cannot log in to my account', description: 'I keep getting an error when signing in.',
    categoryId: 'cat-account', subcategoryId: 'sub-acc-access', concernType: 'account_concern',
    status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'urgent', source: 'web', assigneeId: 'l1_agent', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-13T20:00:00Z', updatedAt: '2026-07-13T20:00:00Z',
  },
  // Unassigned, team-claims, aging — first-response AT RISK.
  {
    id: 'tkt-seed-6', reference: 'HQ-2026-0006', brandId: BRAND, requesterId: 'req-seed-6',
    subject: 'Claim for damaged parcel', description: 'My parcel arrived damaged and I want to file a claim.',
    categoryId: 'cat-claims', subcategoryId: 'sub-cl-damaged', concernType: 'damaged_parcel',
    status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-claims',
    priority: 'high', source: 'web', relatedTransactionId: 'TXN-2004', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-14T05:30:00Z', updatedAt: '2026-07-14T05:30:00Z',
  },
  // Escalated to L2 (Claims) — status stays in_progress; resolution BREACHED.
  {
    id: 'tkt-seed-7', reference: 'HQ-2026-0007', brandId: BRAND, requesterId: 'req-seed-3',
    subject: 'Lost parcel — high value', description: 'A high-value parcel has been missing for over a week.',
    categoryId: 'cat-claims', subcategoryId: 'sub-cl-lost', concernType: 'missing_parcel',
    status: 'in_progress', escalationState: 'escalated', supportTier: 'L2', teamId: 'team-claims',
    priority: 'urgent', source: 'web', assigneeId: 'l2_specialist', relatedTransactionId: 'TXN-2005', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-12T09:00:00Z', updatedAt: '2026-07-13T09:00:00Z', firstResponseAt: '2026-07-12T10:00:00Z', escalatedAt: '2026-07-13T09:00:00Z',
  },
  // Assigned to l1_agent, pending requester — resolution clock PAUSED.
  {
    id: 'tkt-seed-8', reference: 'HQ-2026-0008', brandId: BRAND, requesterId: 'req-seed-3',
    subject: 'Question about my invoice', description: 'Could you clarify a charge on my latest invoice?',
    categoryId: 'cat-general', subcategoryId: 'sub-gen-info', concernType: 'payment_issue',
    status: 'on_hold', holdReason: 'waiting_requester',
    escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'normal', source: 'web', assigneeId: 'l1_agent', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-13T09:00:00Z', updatedAt: '2026-07-13T12:00:00Z', firstResponseAt: '2026-07-13T09:45:00Z',
  },
  // ── M13 transaction-context scenarios (each links a GGX transaction) ──────────
  // Parcel marked delivered but not received.
  {
    id: 'tkt-seed-9', reference: 'HQ-2026-0009', brandId: BRAND, requesterId: 'req-seed-7',
    subject: 'Parcel marked delivered but I never received it', description: 'Tracking says delivered yesterday but nothing arrived.',
    categoryId: 'cat-delivery', subcategoryId: 'sub-del-status', concernType: 'missing_parcel',
    status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'high', source: 'web', relatedTransactionId: 'TXN-2006', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-14T01:00:00Z', updatedAt: '2026-07-14T01:00:00Z',
  },
  // Incorrect COD amount — ON HOLD on a third party (the rider's cash recon).
  {
    id: 'tkt-seed-10', reference: 'HQ-2026-0010', brandId: BRAND, requesterId: 'req-seed-8',
    subject: 'COD amount collected was higher than my order', description: 'The rider collected ₱2,000 but my order was ₱1,750.',
    categoryId: 'cat-cod', subcategoryId: 'sub-cod-amount', concernType: 'cod_concern',
    status: 'on_hold', holdReason: 'waiting_third_party',
    escalationState: 'none', supportTier: 'L1', teamId: 'team-payments',
    priority: 'high', source: 'web', assigneeId: 'l2_specialist', relatedTransactionId: 'TXN-2007', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-12T03:00:00Z', updatedAt: '2026-07-13T02:00:00Z', firstResponseAt: '2026-07-12T04:00:00Z',
  },
  // Failed delivery with an unclear reason.
  {
    id: 'tkt-seed-11', reference: 'HQ-2026-0011', brandId: BRAND, requesterId: 'req-seed-9',
    subject: 'Delivery failed but no reason was given', description: 'I got a failed delivery notice with no explanation.',
    categoryId: 'cat-delivery', subcategoryId: 'sub-del-late', concernType: 'delivery_delay',
    status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'normal', source: 'web', relatedTransactionId: 'TXN-2008', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-13T12:00:00Z', updatedAt: '2026-07-13T12:00:00Z',
  },
  // Returned parcel / disputed return fee.
  {
    id: 'tkt-seed-12', reference: 'HQ-2026-0012', brandId: BRAND, requesterId: 'req-seed-10',
    subject: 'Disputing a return fee on my parcel', description: 'My parcel was returned and I was charged a return fee I do not agree with.',
    categoryId: 'cat-returns', subcategoryId: 'sub-ret-status', concernType: 'general_inquiry',
    status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-claims',
    priority: 'normal', source: 'web', relatedTransactionId: 'TXN-2009', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-12T06:00:00Z', updatedAt: '2026-07-12T06:00:00Z',
  },
  // Payment completed but booking not created.
  {
    id: 'tkt-seed-13', reference: 'HQ-2026-0013', brandId: BRAND, requesterId: 'req-seed-11',
    subject: 'Paid but my booking was never created', description: 'I paid for a shipment but no booking or pickup was scheduled.',
    categoryId: 'cat-payment', subcategoryId: 'sub-pay-failed', concernType: 'booking_issue',
    status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-payments',
    priority: 'urgent', source: 'web', relatedTransactionId: 'TXN-2010', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-14T01:30:00Z', updatedAt: '2026-07-14T01:30:00Z',
  },
  // Incorrect recipient address — just arrived, NOT yet reviewed (status New).
  {
    id: 'tkt-seed-14', reference: 'HQ-2026-0014', brandId: BRAND, requesterId: 'req-seed-12',
    subject: 'Need to correct the recipient address', description: 'The delivery address on my parcel is wrong — please update it.',
    categoryId: 'cat-delivery', subcategoryId: 'sub-del-status', concernType: 'address_correction',
    status: 'new', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'normal', source: 'web', relatedTransactionId: 'TXN-2011', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-14T02:30:00Z', updatedAt: '2026-07-14T02:30:00Z',
  },
  // Closed out earlier on the simulated day — gives the Overview's "Resolved
  // today" counter (M19) a live value instead of a permanent zero.
  {
    id: 'tkt-seed-15', reference: 'HQ-2026-0015', brandId: BRAND, requesterId: 'req-seed-5',
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
    id: 'tkt-seed-16', reference: 'HQ-2026-0016', brandId: BRAND, requesterId: 'req-seed-6',
    subject: 'How do I change my billing email?', description: 'I want invoices sent to a different address.',
    categoryId: 'cat-account', subcategoryId: 'sub-acc-access', concernType: 'account_concern',
    status: 'closed', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'normal', source: 'web', assigneeId: 'l1_agent', slaPolicyId: 'sla-standard',
    resolutionType: 'solved',
    createdAt: '2026-07-09T01:00:00Z', updatedAt: '2026-07-10T05:00:00Z',
    firstResponseAt: '2026-07-09T01:40:00Z', resolvedAt: '2026-07-09T23:00:00Z',
  },
  // REOPENED — the requester came back after we resolved it. Reopening is an
  // event, not a status: the ticket is back In Progress and carries `reopenedAt`.
  {
    id: 'tkt-seed-17', reference: 'HQ-2026-0017', brandId: BRAND, requesterId: 'req-seed-9',
    subject: 'Parcel still not delivered after the promised date', description: 'You closed my last ticket but the parcel never arrived.',
    categoryId: 'cat-delivery', subcategoryId: 'sub-del-late', concernType: 'delivery_delay',
    status: 'in_progress', reopenedAt: '2026-07-13T22:00:00Z',
    escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'high', source: 'web', assigneeId: 'l1_agent', relatedTransactionId: 'TXN-1001', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-11T07:00:00Z', updatedAt: '2026-07-13T22:00:00Z', firstResponseAt: '2026-07-11T08:00:00Z',
  },
  // GGX BUSINESS+ (M22) — submitted by Nadia (Acme Retail) with a linked order.
  // The snapshot was captured while the shipment was still in transit; the live
  // Business+ record has since moved to delivered — a refresh in the agent view
  // shows the change without ever touching the HeyQ ticket status.
  {
    id: 'tkt-seed-18', reference: 'HQ-2026-0018', brandId: BRAND, requesterId: 'req-seed-3',
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
];

export const ticketMessages: TicketMessage[] = [
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
];

// Internal notes — agent-only, never surfaced to requesters (product rule #5).
export const internalNotes: InternalNote[] = [
  { id: 'note-seed-4a', ticketId: 'tkt-seed-4', agentId: 'l1_agent', agentName: 'Alex Cruz', body: 'Likely the crash from the 3.2.1 release. Waiting on device details before flagging to Tech.', createdAt: '2026-07-14T04:35:00Z' },
  { id: 'note-seed-7a', ticketId: 'tkt-seed-7', agentId: 'l2_specialist', agentName: 'Bea Santos', body: 'Trace opened with the hub. High-value — keep the requester updated daily.', createdAt: '2026-07-13T09:10:00Z' },
];

export const statusEvents: StatusEvent[] = [
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

  // The reopen shows in history as resolved → in_progress; the ticket also carries
  // `reopenedAt`, because reopening is an event rather than a status of its own.
  { id: 'se-seed-17a', ticketId: 'tkt-seed-17', actor: 'requester', toStatus: 'new', timestamp: '2026-07-11T07:00:00Z' },
  { id: 'se-seed-17b', ticketId: 'tkt-seed-17', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-11T07:00:01Z' },
  { id: 'se-seed-17c', ticketId: 'tkt-seed-17', actor: 'l1_agent', fromStatus: 'open', toStatus: 'in_progress', timestamp: '2026-07-11T08:00:00Z' },
  { id: 'se-seed-17d', ticketId: 'tkt-seed-17', actor: 'l1_agent', fromStatus: 'in_progress', toStatus: 'resolved', timestamp: '2026-07-12T10:00:00Z' },
  { id: 'se-seed-17e', ticketId: 'tkt-seed-17', actor: 'requester', fromStatus: 'resolved', toStatus: 'in_progress', note: 'Requester replied after resolution', timestamp: '2026-07-13T22:00:00Z' },

  { id: 'se-seed-18a', ticketId: 'tkt-seed-18', actor: 'requester', toStatus: 'new', timestamp: '2026-07-13T05:00:00Z' },
  { id: 'se-seed-18b', ticketId: 'tkt-seed-18', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-13T05:00:01Z' },
];

export const assignments: Assignment[] = [
  { id: 'asg-seed-4a', ticketId: 'tkt-seed-4', actor: 'l1_agent', toAssigneeId: 'l1_agent', toTeamId: 'team-cs', timestamp: '2026-07-14T04:20:00Z' },
  { id: 'asg-seed-5a', ticketId: 'tkt-seed-5', actor: 'l1_agent', toAssigneeId: 'l1_agent', toTeamId: 'team-cs', timestamp: '2026-07-13T20:05:00Z' },
  { id: 'asg-seed-15a', ticketId: 'tkt-seed-15', actor: 'l1_agent', toAssigneeId: 'l1_agent', toTeamId: 'team-cs', timestamp: '2026-07-14T03:20:00Z' },
  { id: 'asg-seed-10a', ticketId: 'tkt-seed-10', actor: 'l2_specialist', toAssigneeId: 'l2_specialist', toTeamId: 'team-payments', timestamp: '2026-07-12T04:00:00Z' },
  { id: 'asg-seed-16a', ticketId: 'tkt-seed-16', actor: 'l1_agent', toAssigneeId: 'l1_agent', toTeamId: 'team-cs', timestamp: '2026-07-09T01:30:00Z' },
  { id: 'asg-seed-17a', ticketId: 'tkt-seed-17', actor: 'l1_agent', toAssigneeId: 'l1_agent', toTeamId: 'team-cs', timestamp: '2026-07-11T08:00:00Z' },
  { id: 'asg-seed-7a', ticketId: 'tkt-seed-7', actor: 'team_lead', fromAssigneeId: undefined, toAssigneeId: 'l2_specialist', fromTeamId: 'team-claims', toTeamId: 'team-claims', timestamp: '2026-07-13T09:00:00Z' },
];

export const escalations: Escalation[] = [
  { id: 'esc-seed-7a', ticketId: 'tkt-seed-7', actor: 'team_lead', direction: 'escalate', fromTier: 'L1', toTier: 'L2', fromTeamId: 'team-claims', toTeamId: 'team-claims', reason: 'high_value', note: 'High-value parcel missing over a week — needs specialist trace.', timestamp: '2026-07-13T09:00:00Z' },
];

export const requesterAccess: RequesterAccess[] = [
  { ticketId: 'tkt-seed-1', accessToken: 'demo-token-parcel', issuedAt: '2026-07-08T02:15:00Z' },
  { ticketId: 'tkt-seed-2', accessToken: 'demo-token-cod', issuedAt: '2026-07-05T01:00:00Z' },
  { ticketId: 'tkt-seed-4', accessToken: 'demo-token-app', issuedAt: '2026-07-14T04:00:00Z' },
  // Nadia Cruz (req-seed-3) — the `customer` demo identity. Her three tickets
  // carry secure links so her Overview (M19) can open them in the portal.
  { ticketId: 'tkt-seed-3', accessToken: 'demo-token-pickup', issuedAt: '2026-07-14T08:00:00Z' },
  { ticketId: 'tkt-seed-7', accessToken: 'demo-token-lost', issuedAt: '2026-07-12T09:00:00Z' },
  { ticketId: 'tkt-seed-8', accessToken: 'demo-token-invoice', issuedAt: '2026-07-13T09:00:00Z' },
  { ticketId: 'tkt-seed-18', accessToken: 'demo-token-bporder', issuedAt: '2026-07-13T05:00:00Z' },
];

// Running reference counter, seeded past the demo tickets.
export const ticketState = { referenceSeq: 18 };
