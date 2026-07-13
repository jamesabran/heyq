import { describe, expect, it } from 'vitest';
import {
  addRequesterMessage,
  createTicket,
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
  it('moves a pending-requester ticket to in_progress on reply', async () => {
    // Seeded ticket tkt-seed-1 starts as pending_requester.
    await addRequesterMessage('tkt-seed-1', 'Here is my tracking number.');
    const view = await resolveAccessToken('demo-token-parcel');
    expect(view?.ticket.status).toBe('in_progress');
  });

  it('reopens a resolved ticket', async () => {
    // Seeded ticket tkt-seed-2 starts as resolved.
    const ticket = await reopenTicket('tkt-seed-2');
    expect(ticket.status).toBe('reopened');
  });
});
