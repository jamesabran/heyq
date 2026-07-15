import { describe, expect, it } from 'vitest';
import { holdTicket, listTickets, resumeTicket } from './ticketService';
import { listTicketsForRequester } from './requesterService';
import { computeSlaSummary } from './slaService';
import { relatedTransactions } from '../data/catalog';
import { tickets } from '../data/tickets';
import {
  TICKET_STATUSES,
  TRACKING_NUMBER_PATTERN,
  isTrackingNumber,
  statusBadgeVariant,
  type TicketStatus,
} from '../models/ticket';
import { worstSlaState } from '../components/ticket/badges';

describe('GGX tracking numbers', () => {
  it('every seeded tracking number matches XXXX-XXXX-XXXX', () => {
    expect(relatedTransactions.length).toBeGreaterThan(0);
    for (const txn of relatedTransactions) {
      expect(txn.trackingNumber).toMatch(TRACKING_NUMBER_PATTERN);
    }
  });

  it('tracking numbers are unique and distinct from HeyQ ticket references', () => {
    const numbers = relatedTransactions.map((t) => t.trackingNumber);
    expect(new Set(numbers).size).toBe(numbers.length);

    // A ticket reference (HQ-2026-0003) must never be mistaken for a tracking number.
    for (const ticket of tickets) {
      expect(isTrackingNumber(ticket.reference)).toBe(false);
    }
  });

  it('surfaces the tracking number on the list item, and nothing on a non-shipment ticket', async () => {
    const items = await listTickets();

    const shipment = items.find((i) => i.ticket.relatedTransactionId);
    expect(shipment?.trackingNumber).toMatch(TRACKING_NUMBER_PATTERN);

    // tkt-seed-5 (a login problem) has no shipment — the table renders an em dash.
    const nonShipment = items.find((i) => i.ticket.id === 'tkt-seed-5');
    expect(nonShipment?.ticket.relatedTransactionId).toBeUndefined();
    expect(nonShipment?.trackingNumber).toBeUndefined();
  });
});

describe('requester-facing lists', () => {
  it('show the same tracking number the agent lists show', async () => {
    const summaries = await listTicketsForRequester('req-seed-3');
    expect(summaries.length).toBeGreaterThan(0);

    const withShipment = summaries.find((s) => s.ticket.relatedTransactionId);
    expect(withShipment?.trackingNumber).toMatch(TRACKING_NUMBER_PATTERN);
  });
});

describe('ticket search', () => {
  it('matches a full tracking number', async () => {
    const items = await listTickets({ search: 'D4XV-A7ND-SQCZ' });
    expect(items).toHaveLength(1);
    expect(items[0].ticket.reference).toBe('HQ-2026-0002');
  });

  it('matches a partial tracking number, case-insensitively', async () => {
    const items = await listTickets({ search: 'a7nd' });
    expect(items).toHaveLength(1);
    expect(items[0].trackingNumber).toBe('D4XV-A7ND-SQCZ');
  });

  it('matches the reference, concern type, requester name, and requester email', async () => {
    expect(await listTickets({ search: 'HQ-2026-0005' })).toHaveLength(1);

    const byConcern = await listTickets({ search: 'remittance' });
    expect(byConcern.length).toBeGreaterThan(0);
    expect(byConcern.every((i) => i.ticket.concernType === 'remittance_concern')).toBe(true);

    const byName = await listTickets({ search: 'nadia' });
    expect(byName.length).toBeGreaterThan(0);

    const byEmail = await listTickets({ search: 'liza.aquino@example.com' });
    expect(byEmail).toHaveLength(1);
    expect(byEmail[0].requesterName).toBe('Liza Aquino');
  });
});

describe('sample data coverage', () => {
  it('exercises all six core statuses', () => {
    const present = new Set<TicketStatus>(tickets.map((t) => t.status));
    for (const status of TICKET_STATUSES) {
      expect(present.has(status)).toBe(true);
    }
  });

  it('has an on-hold ticket with a reason, an escalated ticket, and a reopened one', () => {
    const onHold = tickets.filter((t) => t.status === 'on_hold');
    expect(onHold.length).toBeGreaterThan(0);
    expect(onHold.every((t) => t.holdReason !== undefined)).toBe(true);

    expect(tickets.some((t) => t.escalationState === 'escalated')).toBe(true);
    expect(tickets.some((t) => t.reopenedAt)).toBe(true);
  });

  it('covers every priority and the three headline SLA states', async () => {
    const priorities = new Set(tickets.map((t) => t.priority));
    expect(priorities).toEqual(new Set(['normal', 'high', 'urgent']));

    const items = await listTickets();
    const slaStates = new Set(items.map((i) => worstSlaState(i.sla)));
    expect(slaStates.has('on_track')).toBe(true);
    expect(slaStates.has('at_risk')).toBe(true);
    expect(slaStates.has('breached')).toBe(true);
  });

  it('spreads work across teams and assignees', () => {
    expect(new Set(tickets.map((t) => t.teamId)).size).toBeGreaterThan(1);
    expect(new Set(tickets.filter((t) => t.assigneeId).map((t) => t.assigneeId)).size).toBeGreaterThan(1);
    expect(tickets.some((t) => !t.assigneeId)).toBe(true);
  });
});

describe('on hold', () => {
  it('records the reason, and clears it on resume', async () => {
    const held = await holdTicket('tkt-seed-3', 'l1_agent', 'waiting_internal');
    expect(held.status).toBe('on_hold');
    expect(held.holdReason).toBe('waiting_internal');

    const resumed = await resumeTicket('tkt-seed-3', 'l1_agent');
    expect(resumed.status).toBe('in_progress');
    expect(resumed.holdReason).toBeUndefined();
  });

  it('pauses the resolution clock only when blocked by someone outside the team', async () => {
    // Blocked on the requester — not our delay, so the clock stops.
    const external = await holdTicket('tkt-seed-6', 'l1_agent', 'waiting_requester');
    expect(computeSlaSummary(external).resolution.state).toBe('paused');

    // Blocked on our own internal team — that delay is ours, so the clock runs.
    const internal = await holdTicket('tkt-seed-6', 'l1_agent', 'waiting_internal');
    expect(computeSlaSummary(internal).resolution.state).not.toBe('paused');
  });
});

describe('semantic status colours', () => {
  it('never paints an in-progress ticket red, and reserves red for real trouble', () => {
    // In Progress is active work, not an error — blue/teal, never brand/destructive.
    expect(statusBadgeVariant('in_progress')).toBe('teal');
    expect(statusBadgeVariant('new')).toBe('info');
    expect(statusBadgeVariant('open')).toBe('info-solid');
    expect(statusBadgeVariant('on_hold')).toBe('warning');
    expect(statusBadgeVariant('resolved')).toBe('success');
    expect(statusBadgeVariant('closed')).toBe('default');

    // No status is destructive: red belongs to urgent/breached/failed, not a workflow state.
    for (const status of TICKET_STATUSES) {
      expect(statusBadgeVariant(status)).not.toBe('destructive');
      expect(statusBadgeVariant(status)).not.toBe('brand');
    }
  });
});
