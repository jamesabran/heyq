// Ticket mock state (module state, mutated by ticketService). Components must
// access this only through services. Seeded with two tickets so the requester
// portal works out of the box: one Pending Requester (reply -> In Progress) and
// one Resolved (reopen demo). Access tokens are opaque simulated strings.
import type {
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
];

export const tickets: Ticket[] = [
  {
    id: 'tkt-seed-1', reference: 'HQ-2026-0001', brandId: BRAND, requesterId: 'req-seed-1',
    subject: 'Where is my parcel?', description: 'My parcel has not moved in three days.',
    categoryId: 'cat-delivery', subcategoryId: 'sub-del-status',
    status: 'pending_requester', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'normal', source: 'web', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-08T02:15:00Z', updatedAt: '2026-07-09T06:40:00Z', firstResponseAt: '2026-07-08T03:00:00Z',
  },
  {
    id: 'tkt-seed-2', reference: 'HQ-2026-0002', brandId: BRAND, requesterId: 'req-seed-2',
    subject: 'COD remittance not received', description: 'I have not received my COD remittance for last week.',
    categoryId: 'cat-cod', subcategoryId: 'sub-cod-remit',
    status: 'resolved', escalationState: 'none', supportTier: 'L2', teamId: 'team-payments',
    priority: 'high', source: 'web', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-05T01:00:00Z', updatedAt: '2026-07-07T08:30:00Z', firstResponseAt: '2026-07-05T02:10:00Z', resolvedAt: '2026-07-07T08:30:00Z',
  },
  // Unassigned, team-cs, fresh — first-response on track.
  {
    id: 'tkt-seed-3', reference: 'HQ-2026-0003', brandId: BRAND, requesterId: 'req-seed-3',
    subject: 'Rider did not arrive for pickup', description: 'I booked a pickup this morning but no rider came.',
    categoryId: 'cat-pickup', subcategoryId: 'sub-pu-missed',
    status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'normal', source: 'web', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-14T08:00:00Z', updatedAt: '2026-07-14T08:00:00Z',
  },
  // Assigned to l1_agent, in progress — first-response met, resolution on track.
  {
    id: 'tkt-seed-4', reference: 'HQ-2026-0004', brandId: BRAND, requesterId: 'req-seed-4',
    subject: 'App crashes when opening bookings', description: 'The app closes whenever I tap on My Bookings.',
    categoryId: 'cat-technical', subcategoryId: 'sub-tech-app',
    status: 'in_progress', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'high', source: 'web', assigneeId: 'l1_agent', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-14T04:00:00Z', updatedAt: '2026-07-14T04:30:00Z', firstResponseAt: '2026-07-14T04:30:00Z',
  },
  // Assigned to l1_agent, open, no first response yet — first-response BREACHED.
  {
    id: 'tkt-seed-5', reference: 'HQ-2026-0005', brandId: BRAND, requesterId: 'req-seed-5',
    subject: 'Cannot log in to my account', description: 'I keep getting an error when signing in.',
    categoryId: 'cat-account', subcategoryId: 'sub-acc-access',
    status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'urgent', source: 'web', assigneeId: 'l1_agent', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-13T20:00:00Z', updatedAt: '2026-07-13T20:00:00Z',
  },
  // Unassigned, team-claims, aging — first-response AT RISK.
  {
    id: 'tkt-seed-6', reference: 'HQ-2026-0006', brandId: BRAND, requesterId: 'req-seed-6',
    subject: 'Claim for damaged parcel', description: 'My parcel arrived damaged and I want to file a claim.',
    categoryId: 'cat-claims', subcategoryId: 'sub-cl-damaged',
    status: 'open', escalationState: 'none', supportTier: 'L1', teamId: 'team-claims',
    priority: 'high', source: 'web', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-14T05:30:00Z', updatedAt: '2026-07-14T05:30:00Z',
  },
  // Escalated to L2 (Claims) — status stays in_progress; resolution BREACHED.
  {
    id: 'tkt-seed-7', reference: 'HQ-2026-0007', brandId: BRAND, requesterId: 'req-seed-3',
    subject: 'Lost parcel — high value', description: 'A high-value parcel has been missing for over a week.',
    categoryId: 'cat-claims', subcategoryId: 'sub-cl-lost',
    status: 'in_progress', escalationState: 'escalated', supportTier: 'L2', teamId: 'team-claims',
    priority: 'urgent', source: 'web', assigneeId: 'l2_specialist', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-12T09:00:00Z', updatedAt: '2026-07-13T09:00:00Z', firstResponseAt: '2026-07-12T10:00:00Z', escalatedAt: '2026-07-13T09:00:00Z',
  },
  // Assigned to l1_agent, pending requester — resolution clock PAUSED.
  {
    id: 'tkt-seed-8', reference: 'HQ-2026-0008', brandId: BRAND, requesterId: 'req-seed-4',
    subject: 'Question about my invoice', description: 'Could you clarify a charge on my latest invoice?',
    categoryId: 'cat-general', subcategoryId: 'sub-gen-info',
    status: 'pending_requester', escalationState: 'none', supportTier: 'L1', teamId: 'team-cs',
    priority: 'low', source: 'web', assigneeId: 'l1_agent', slaPolicyId: 'sla-standard',
    createdAt: '2026-07-13T09:00:00Z', updatedAt: '2026-07-13T12:00:00Z', firstResponseAt: '2026-07-13T09:45:00Z',
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
  { id: 'msg-seed-8a', ticketId: 'tkt-seed-8', authorType: 'requester', authorId: 'req-seed-4', authorName: 'Oliver Tan', body: 'Could you clarify a charge on my latest invoice?', channel: 'web', visibility: 'public', createdAt: '2026-07-13T09:00:00Z' },
  { id: 'msg-seed-8b', ticketId: 'tkt-seed-8', authorType: 'agent', authorId: 'l1_agent', authorName: 'Alex Cruz', body: 'Could you share the invoice number so I can check?', channel: 'web', visibility: 'public', createdAt: '2026-07-13T09:45:00Z' },
];

// Internal notes — agent-only, never surfaced to requesters (product rule #5).
export const internalNotes: InternalNote[] = [
  { id: 'note-seed-4a', ticketId: 'tkt-seed-4', agentId: 'l1_agent', agentName: 'Alex Cruz', body: 'Likely the crash from the 3.2.1 release. Waiting on device details before flagging to Tech.', createdAt: '2026-07-14T04:35:00Z' },
  { id: 'note-seed-7a', ticketId: 'tkt-seed-7', agentId: 'l2_specialist', agentName: 'Bea Santos', body: 'Trace opened with the hub. High-value — keep the requester updated daily.', createdAt: '2026-07-13T09:10:00Z' },
];

export const statusEvents: StatusEvent[] = [
  { id: 'se-seed-1a', ticketId: 'tkt-seed-1', actor: 'system', toStatus: 'new', timestamp: '2026-07-08T02:15:00Z' },
  { id: 'se-seed-1b', ticketId: 'tkt-seed-1', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-08T02:15:05Z' },
  { id: 'se-seed-1c', ticketId: 'tkt-seed-1', actor: 'l1_agent', fromStatus: 'open', toStatus: 'pending_requester', timestamp: '2026-07-08T03:00:00Z' },
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
  { id: 'se-seed-8d', ticketId: 'tkt-seed-8', actor: 'l1_agent', fromStatus: 'in_progress', toStatus: 'pending_requester', timestamp: '2026-07-13T09:46:00Z' },
];

export const requesterAccess: RequesterAccess[] = [
  { ticketId: 'tkt-seed-1', accessToken: 'demo-token-parcel', issuedAt: '2026-07-08T02:15:00Z' },
  { ticketId: 'tkt-seed-2', accessToken: 'demo-token-cod', issuedAt: '2026-07-05T01:00:00Z' },
  { ticketId: 'tkt-seed-4', accessToken: 'demo-token-app', issuedAt: '2026-07-14T04:00:00Z' },
];

// Running reference counter, seeded past the demo tickets.
export const ticketState = { referenceSeq: 8 };
