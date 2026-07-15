import { afterEach, describe, expect, it } from 'vitest';
import {
  addAgentReply,
  addInternalNote,
  addRequesterMessage,
  claimTicket,
  createTicket,
  getTicketDetail,
  listMessages,
  listTickets,
  resolveTicket,
} from './ticketService';
import { getSummary } from './reportsService';
import {
  getOrderProvider,
  setBusinessPlusOrderShipmentStatusForTest,
  setBusinessPlusProviderDown,
} from './orderProvider';

const nadiaBp = { externalUserId: 'bp-user-nadia', externalOrgId: 'bp-org-acme' };

/** A linked submission exactly as the contact form sends it for Nadia. */
function linkedInput(externalOrderId: string) {
  return {
    name: 'Nadia Cruz',
    email: 'nadia.cruz@example.com',
    categoryId: 'cat-delivery',
    subject: 'Business+ linked concern',
    description: 'The recipient reports a delivery problem on this order.',
    requesterId: 'req-seed-3',
    businessPlusOrder: { identity: nadiaBp, externalOrderId },
  };
}

afterEach(async () => {
  await setBusinessPlusProviderDown(false);
});

describe('Business+ linked ticket — full lifecycle (M22)', () => {
  it('runs submission → queue → assignment → replies → resolve → reopen on one native ticket', async () => {
    const before = await getSummary();

    // Submission: the order is authorized, snapshotted, and the ticket is native.
    const { ticket, reference, accessToken } = await createTicket(linkedInput('BP-ORD-7001'));
    // The primary key is HeyQ-generated; the external id is reference data only.
    expect(ticket.id).toMatch(/^tkt[_-]/);
    expect(ticket.id).not.toContain('BP-ORD');
    expect(ticket.sourceSystem).toBe('ggx_business_plus');
    expect(ticket.linkedOrder?.externalOrderId).toBe('BP-ORD-7001');
    expect(ticket.linkedOrder?.trackingNumber).toBe('Q7PL-2MRX-J90A');
    expect(ticket.linkedOrder?.snapshot.shipmentStatus).toBe('out_for_delivery');
    expect(ticket.requesterId).toBe('req-seed-3'); // reused, not duplicated
    expect(ticket.status).toBe('open');
    expect(ticket.assigneeId).toBeUndefined();
    expect(accessToken).toBeTruthy();

    // Queue reception: it lands in the routed team's unassigned queue and is
    // findable by a partial tracking-number search like any other ticket.
    const unassigned = await listTickets({ queue: 'unassigned', viewerTeamId: ticket.teamId });
    expect(unassigned.some((i) => i.ticket.id === ticket.id)).toBe(true);
    const byTracking = await listTickets({ search: 'q7pl' });
    expect(byTracking.map((i) => i.ticket.reference)).toContain(reference);

    // Counters: reports see it as ordinary open work.
    const after = await getSummary();
    expect(after.open).toBe(before.open + 1);
    expect(after.total).toBe(before.total + 1);

    // Assignment.
    const claimed = await claimTicket(ticket.id, 'l1_agent');
    expect(claimed.assigneeId).toBe('l1_agent');

    // Public reply reaches the requester; the internal note never does.
    await addAgentReply(ticket.id, 'l1_agent', 'We are checking with the delivery hub.');
    await addInternalNote(ticket.id, 'l1_agent', 'Hub suspects a mis-sort — do not share yet.');
    const publicThread = await listMessages(ticket.id);
    expect(publicThread.some((m) => m.body.includes('checking with the delivery hub'))).toBe(true);
    expect(JSON.stringify(publicThread)).not.toContain('mis-sort');

    // Requester replies; agent resolves; the requester's post-resolution reply
    // follows the standard reopen rule — back to in_progress (it has an owner),
    // stamped reopenedAt, resolution cleared.
    await addRequesterMessage(ticket.id, 'Any update on this?');
    await resolveTicket(ticket.id, 'l1_agent', 'solved', 'Parcel re-dispatched.');
    expect((await getTicketDetail(ticket.id))?.ticket.status).toBe('resolved');

    await addRequesterMessage(ticket.id, 'It still has not arrived.');
    const reopened = (await getTicketDetail(ticket.id))!.ticket;
    expect(reopened.status).toBe('in_progress');
    expect(reopened.reopenedAt).toBeTruthy();
    expect(reopened.resolvedAt).toBeUndefined();

    // The audit trail recorded the whole journey as status history.
    const timeline = (await getTicketDetail(ticket.id))!.timeline;
    expect(timeline.some((e) => e.summary.includes('Ticket created'))).toBe(true);
    expect(timeline.some((e) => e.summary.includes('Resolved'))).toBe(true);
  });

  it('rejects linking an order outside the requester organization', async () => {
    // BP-ORD-8001 belongs to Zenith; Nadia must not be able to link it — and the
    // failed attempt must not create a ticket.
    const before = (await listTickets()).length;
    await expect(createTicket(linkedInput('BP-ORD-8001'))).rejects.toThrow(/not available on your account/i);
    expect((await listTickets()).length).toBe(before);
  });

  it('fails cleanly when the provider is down at submission, and works without a link', async () => {
    await setBusinessPlusProviderDown(true);

    await expect(createTicket(linkedInput('BP-ORD-7001'))).rejects.toThrow(/unreachable/i);

    // The requester is never blocked from getting help: the same submission
    // without the order link succeeds while the provider is down.
    const withoutLink = { ...linkedInput('BP-ORD-7001'), businessPlusOrder: undefined };
    const { ticket } = await createTicket(withoutLink);
    expect(ticket.sourceSystem).toBeUndefined();
    expect(ticket.linkedOrder).toBeUndefined();
    expect(ticket.status).toBe('open');
  });

  it('keeps a linked ticket fully usable from its snapshot after the provider dies', async () => {
    const { ticket } = await createTicket(linkedInput('BP-ORD-7004'));
    await setBusinessPlusProviderDown(true);

    // Live context is gone…
    expect((await getOrderProvider().getOrderForSupport('BP-ORD-7004')).status).toBe('unavailable');

    // …but the ticket still lists, searches, and shows its saved order context.
    const detail = await getTicketDetail(ticket.id);
    expect(detail?.ticket.linkedOrder?.snapshot.shipmentStatus).toBe('booked');
    const rows = await listTickets({ search: 'r9gc' });
    expect(rows.some((i) => i.ticket.id === ticket.id)).toBe(true);
    expect(rows.find((i) => i.ticket.id === ticket.id)?.trackingNumber).toBe('R9GC-5ZLH-K73P');
  });

  it('never lets a live shipment change touch the HeyQ ticket status or snapshot', async () => {
    const { ticket } = await createTicket(linkedInput('BP-ORD-7002'));
    expect(ticket.linkedOrder?.snapshot.shipmentStatus).toBe('failed_delivery');

    // The shipment moves on upstream (mutating the store stands in for
    // Business+ updating its own record).
    await setBusinessPlusOrderShipmentStatusForTest('BP-ORD-7002', 'returned');
    try {
      const live = await getOrderProvider().getOrderForSupport('BP-ORD-7002');
      if (live.status !== 'ok') throw new Error('expected ok');
      expect(live.order.shipmentStatus).toBe('returned');

      const detail = (await getTicketDetail(ticket.id))!;
      expect(detail.ticket.status).toBe('open'); // untouched
      expect(detail.ticket.linkedOrder?.snapshot.shipmentStatus).toBe('failed_delivery'); // untouched
    } finally {
      await setBusinessPlusOrderShipmentStatusForTest('BP-ORD-7002', 'failed_delivery');
    }
  });

  it('supports reopening the seeded closed-out flow for linked tickets too', async () => {
    // tkt-seed-18 is the seeded Business+ ticket; resolve then reopen it through
    // the requester-reply rule to prove linked tickets follow the standard rules.
    await claimTicket('tkt-seed-18', 'l1_agent');
    await resolveTicket('tkt-seed-18', 'l1_agent', 'solved');
    await addRequesterMessage('tkt-seed-18', 'The Davao customer says it is still missing.');

    const detail = (await getTicketDetail('tkt-seed-18'))!;
    expect(detail.ticket.status).toBe('in_progress');
    expect(detail.ticket.reopenedAt).toBeTruthy();
    expect(detail.ticket.linkedOrder?.externalOrderId).toBe('BP-ORD-7003');
  });
});
