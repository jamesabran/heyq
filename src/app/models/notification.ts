// Simulated notification (in-app feed item). `emailed` marks events that also
// "sent an email" to the requester — a UI marker only, no real delivery.
export type NotificationEvent =
  | 'requester_replied'
  | 'ticket_assigned'
  | 'ticket_escalated'
  | 'ticket_resolved'
  | 'reply_sent';

export interface Notification {
  id: string;
  recipientId: string;
  event: NotificationEvent;
  title: string;
  ticketId?: string;
  ticketRef?: string;
  emailed: boolean;
  read: boolean;
  createdAt: string;
}

export const NOTIFICATION_EVENT_LABELS: Record<NotificationEvent, string> = {
  requester_replied: 'Requester replied',
  ticket_assigned: 'Ticket assigned',
  ticket_escalated: 'Ticket escalated',
  ticket_resolved: 'Ticket resolved',
  reply_sent: 'Reply sent',
};
