import { describe, expect, it } from 'vitest';
import {
  listForRecipient,
  markAllRead,
  setEventMuted,
  unreadCount,
} from './notificationService';
import { addRequesterMessage, resolveTicket } from './ticketService';

describe('notifications', () => {
  it('lists seeded notifications for a recipient', async () => {
    const feed = await listForRecipient('l1_agent');
    expect(feed.length).toBeGreaterThan(0);
    expect(feed.every((n) => n.recipientId === 'l1_agent')).toBe(true);
  });

  it('emits one notification to the assignee when the requester replies, and dedups repeats', async () => {
    // tkt-seed-4 is assigned to l1_agent.
    await addRequesterMessage('tkt-seed-4', 'First follow-up');
    await addRequesterMessage('tkt-seed-4', 'Second follow-up');
    const feed = await listForRecipient('l1_agent');
    const forTicket = feed.filter((n) => n.event === 'requester_replied' && n.ticketId === 'tkt-seed-4');
    expect(forTicket).toHaveLength(1); // deduped within the window
  });

  it('marks the emailed flag on resolution notifications', async () => {
    await resolveTicket('tkt-seed-5', 'l1_agent', 'solved');
    const feed = await listForRecipient('l1_agent');
    const resolved = feed.find((n) => n.event === 'ticket_resolved' && n.ticketId === 'tkt-seed-5');
    expect(resolved?.emailed).toBe(true);
  });

  it('suppresses muted event types', async () => {
    await setEventMuted('ticket_resolved', true);
    await resolveTicket('tkt-seed-3', 'l1_agent', 'solved');
    const feed = await listForRecipient('l1_agent');
    expect(feed.some((n) => n.event === 'ticket_resolved' && n.ticketId === 'tkt-seed-3')).toBe(false);
    await setEventMuted('ticket_resolved', false);
  });

  it('marks all read', async () => {
    await markAllRead('l1_agent');
    expect(await unreadCount('l1_agent')).toBe(0);
  });
});
