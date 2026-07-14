import { describe, expect, it } from 'vitest';
import {
  addRequesterMessage,
  createInternalTicket,
  createTicket,
  getTicketDetail,
  listMessages,
  reopenTicket,
} from './ticketService';
import { resolveAccessToken } from './requesterService';

const baseInput = {
  name: 'Test User',
  email: 'test.user@example.com',
  subject: 'Test subject',
  description: 'Test description',
};

describe('ticketService.createTicket', () => {
  it('routes a claims concern to the Claims team and opens the ticket unassigned', async () => {
    const { ticket } = await createTicket({ ...baseInput, categoryId: 'cat-claims' });
    expect(ticket.teamId).toBe('team-claims');
    expect(ticket.status).toBe('open');
    expect(ticket.assigneeId).toBeUndefined();
    expect(ticket.escalationState).toBe('none');
  });

  it('generates a unique reference and an opaque access token', async () => {
    const a = await createTicket({ ...baseInput, categoryId: 'cat-general' });
    const b = await createTicket({ ...baseInput, categoryId: 'cat-general' });
    expect(a.reference).not.toBe(b.reference);
    expect(a.reference).toMatch(/^HQ-2026-\d{4}$/);
    expect(a.accessToken).toEqual(expect.any(String));
    expect(a.accessToken).not.toBe(a.reference);
  });

  it('seeds the conversation with the requester description and a system acknowledgement', async () => {
    const { ticket } = await createTicket({ ...baseInput, categoryId: 'cat-general' });
    const messages = await listMessages(ticket.id);
    expect(messages).toHaveLength(2);
    expect(messages[0].authorType).toBe('requester');
    expect(messages[1].authorType).toBe('system');
    expect(messages.every((m) => m.visibility === 'public')).toBe(true);
  });

  it('marks a ticket from a transaction with source=transaction', async () => {
    const { ticket } = await createTicket({ ...baseInput, categoryId: 'cat-delivery', relatedTransactionId: 'TXN-1001' });
    expect(ticket.source).toBe('transaction');
    expect(ticket.relatedTransactionId).toBe('TXN-1001');
  });

  it('derives a default Concern Type from the category, and honours an explicit one', async () => {
    const derived = await createTicket({ ...baseInput, categoryId: 'cat-pickup' });
    expect(derived.ticket.concernType).toBe('pickup_issue');
    const explicit = await createTicket({ ...baseInput, categoryId: 'cat-delivery', concernType: 'address_correction' });
    expect(explicit.ticket.concernType).toBe('address_correction');
  });
});

describe('internal ticket creation (M16)', () => {
  const internalBase = {
    reporterId: 'l1_agent',
    categoryId: 'cat-technical',
    subject: 'Monitoring: elevated app crash rate',
    description: 'Crash-rate alert fired for the bookings screen.',
    priority: 'high' as const,
  };

  it('creates an internal ticket on the standard lifecycle with notifications off by default', async () => {
    const { ticket } = await createInternalTicket(internalBase);
    expect(ticket.source).toBe('internal');
    expect(ticket.status).toBe('open'); // seven-status lifecycle, no separate model
    expect(ticket.reporterId).toBe('l1_agent');
    expect(ticket.requesterNotificationsEnabled).toBe(false);
  });

  it('records the creator in the audit/timeline history', async () => {
    const { ticket } = await createInternalTicket(internalBase);
    const detail = await getTicketDetail(ticket.id);
    const creation = detail?.timeline.find((e) => e.summary.includes('created'));
    expect(creation?.actor).toBe('Alex Cruz'); // reporter, resolved to agent name
  });

  it('enables requester notifications only when an external requester is added and opted in', async () => {
    const off = await createInternalTicket({ ...internalBase, requesterName: 'Ext Customer' });
    expect(off.ticket.requesterNotificationsEnabled).toBe(false); // external but not opted in
    const on = await createInternalTicket({ ...internalBase, requesterName: 'Ext Customer', requesterNotificationsEnabled: true });
    expect(on.ticket.requesterNotificationsEnabled).toBe(true);
    // A purely internal ticket can never enable requester notifications.
    const internalOnly = await createInternalTicket({ ...internalBase, requesterNotificationsEnabled: true });
    expect(internalOnly.ticket.requesterNotificationsEnabled).toBe(false);
  });
});

describe('requester portal access', () => {
  it('resolves a ticket only via its access token, never its reference', async () => {
    const { ticket, accessToken, reference } = await createTicket({ ...baseInput, categoryId: 'cat-general' });
    const view = await resolveAccessToken(accessToken);
    expect(view?.ticket.id).toBe(ticket.id);
    // The reference must NOT be usable as a token.
    expect(await resolveAccessToken(reference)).toBeNull();
    expect(await resolveAccessToken('not-a-real-token')).toBeNull();
  });
});

describe('requester replies and reopen', () => {
  it('lifts a hold placed on the requester when they reply', async () => {
    // tkt-seed-1 is on hold waiting for the requester — their reply unblocks it.
    await addRequesterMessage('tkt-seed-1', 'Here is my tracking number.');
    const view = await resolveAccessToken('demo-token-parcel');
    expect(view?.ticket.status).toBe('in_progress');
    expect(view?.ticket.holdReason).toBeUndefined();
  });

  it('reopens a resolved ticket back to an active status, recording the reopen', async () => {
    // Reopening is an EVENT, not a status: tkt-seed-2 is resolved and unassigned,
    // so it returns to `open` and is stamped with `reopenedAt`.
    const ticket = await reopenTicket('tkt-seed-2');
    expect(ticket.status).toBe('open');
    expect(ticket.reopenedAt).toBeTruthy();
    // The resolution no longer stands.
    expect(ticket.resolvedAt).toBeUndefined();
  });

  it('returns a reopened ticket to in_progress when it still has an owner', async () => {
    // tkt-seed-16 is closed and still assigned to l1_agent.
    const ticket = await reopenTicket('tkt-seed-16');
    expect(ticket.status).toBe('in_progress');
    expect(ticket.reopenedAt).toBeTruthy();
  });
});
