// Notification mock state (module state, mutated by notificationService). Seeded
// so the agent feed is populated on first load.
import type { Notification, NotificationEvent } from '../models/notification';

export const notifications: Notification[] = [
  { id: 'ntf-seed-1', recipientId: 'l1_agent', event: 'requester_replied', title: 'New reply from Liza Aquino', ticketId: 'tkt-seed-1', ticketRef: 'HQ-2026-0001', emailed: false, read: false, createdAt: '2026-07-14T07:30:00Z' },
  { id: 'ntf-seed-2', recipientId: 'l1_agent', event: 'ticket_assigned', title: 'Assigned: Cannot log in to my account', ticketId: 'tkt-seed-5', ticketRef: 'HQ-2026-0005', emailed: false, read: false, createdAt: '2026-07-13T20:05:00Z' },
  { id: 'ntf-seed-3', recipientId: 'l2_specialist', event: 'ticket_escalated', title: 'Escalated: Lost parcel — high value', ticketId: 'tkt-seed-7', ticketRef: 'HQ-2026-0007', emailed: false, read: true, createdAt: '2026-07-13T09:00:00Z' },
];

// Simulated preferences: muted event types are suppressed on emit.
export const notificationPrefs: { muted: NotificationEvent[] } = { muted: [] };
