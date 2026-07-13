// Ticket mock state (module state, mutated by ticketService). Components must
// access this only through services. Seeded with two tickets so the requester
// portal works out of the box: one Pending Requester (reply -> In Progress) and
// one Resolved (reopen demo). Access tokens are opaque simulated strings.
import type {
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
];

export const ticketMessages: TicketMessage[] = [
  { id: 'msg-seed-1a', ticketId: 'tkt-seed-1', authorType: 'requester', authorId: 'req-seed-1', authorName: 'Liza Aquino', body: 'My parcel has not moved in three days.', channel: 'web', visibility: 'public', createdAt: '2026-07-08T02:15:00Z' },
  { id: 'msg-seed-1b', ticketId: 'tkt-seed-1', authorType: 'agent', authorId: 'l1_agent', authorName: 'Alex Cruz', body: 'Thanks for reaching out. Could you confirm your tracking number so we can check?', channel: 'web', visibility: 'public', createdAt: '2026-07-08T03:00:00Z' },
  { id: 'msg-seed-2a', ticketId: 'tkt-seed-2', authorType: 'requester', authorId: 'req-seed-2', authorName: 'Marco Reyes', body: 'I have not received my COD remittance for last week.', channel: 'web', visibility: 'public', createdAt: '2026-07-05T01:00:00Z' },
  { id: 'msg-seed-2b', ticketId: 'tkt-seed-2', authorType: 'agent', authorId: 'l2_specialist', authorName: 'Bea Santos', body: 'Your remittance has been reprocessed and should reflect within 24 hours. Marking this resolved.', channel: 'web', visibility: 'public', createdAt: '2026-07-07T08:30:00Z' },
];

export const statusEvents: StatusEvent[] = [
  { id: 'se-seed-1a', ticketId: 'tkt-seed-1', actor: 'system', toStatus: 'new', timestamp: '2026-07-08T02:15:00Z' },
  { id: 'se-seed-1b', ticketId: 'tkt-seed-1', actor: 'system', fromStatus: 'new', toStatus: 'open', timestamp: '2026-07-08T02:15:05Z' },
  { id: 'se-seed-1c', ticketId: 'tkt-seed-1', actor: 'l1_agent', fromStatus: 'open', toStatus: 'pending_requester', timestamp: '2026-07-08T03:00:00Z' },
  { id: 'se-seed-2a', ticketId: 'tkt-seed-2', actor: 'system', toStatus: 'new', timestamp: '2026-07-05T01:00:00Z' },
  { id: 'se-seed-2b', ticketId: 'tkt-seed-2', actor: 'l2_specialist', fromStatus: 'in_progress', toStatus: 'resolved', timestamp: '2026-07-07T08:30:00Z' },
];

export const requesterAccess: RequesterAccess[] = [
  { ticketId: 'tkt-seed-1', accessToken: 'demo-token-parcel', issuedAt: '2026-07-08T02:15:00Z' },
  { ticketId: 'tkt-seed-2', accessToken: 'demo-token-cod', issuedAt: '2026-07-05T01:00:00Z' },
];

// Running reference counter, seeded past the demo tickets.
export const ticketState = { referenceSeq: 2 };
