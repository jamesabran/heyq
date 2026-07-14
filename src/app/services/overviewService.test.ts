import { describe, expect, it } from 'vitest';
import { getOverview, type TicketOverview } from './overviewService';

const counter = (o: TicketOverview, key: string) => o.counters.find((c) => c.key === key);
const list = (o: TicketOverview, key: string) => o.lists.find((l) => l.key === key);

describe('overviewService — role scoping (M19)', () => {
  it('scopes an agent to their own assignments and their team pool', async () => {
    const data = await getOverview({ id: 'l1_agent', role: 'l1_agent', teamId: 'team-cs' });
    if (data.kind !== 'tickets') throw new Error('expected a ticket overview');

    // Open and assigned to l1_agent: tkt-seed-4 (high), tkt-seed-5 (urgent),
    // tkt-seed-8 (on hold), tkt-seed-17 (reopened). tkt-seed-15 resolved today;
    // tkt-seed-16 is closed, so it counts toward neither.
    expect(counter(data, 'assigned')?.value).toBe(4);
    expect(counter(data, 'urgent')?.value).toBe(1);
    expect(counter(data, 'reopened')?.value).toBe(1);
    expect(counter(data, 'resolved_today')?.value).toBe(1);

    // Attention is limited to *their* tickets — never another agent's.
    const attention = list(data, 'attention');
    expect(attention?.rows.length).toBeGreaterThan(0);
    for (const row of attention!.rows) {
      expect(row.item.ticket.assigneeId).toBe('l1_agent');
    }

    // The unassigned pool stays inside their team.
    for (const row of list(data, 'unassigned')!.rows) {
      expect(row.item.ticket.teamId).toBe('team-cs');
      expect(row.item.ticket.assigneeId).toBeUndefined();
    }
  });

  it('scopes a team lead to their team and an admin to the whole org', async () => {
    const lead = await getOverview({ id: 'team_lead', role: 'team_lead', teamId: 'team-cs' });
    const admin = await getOverview({ id: 'admin', role: 'admin' });
    if (lead.kind !== 'tickets' || admin.kind !== 'tickets') throw new Error('expected ticket overviews');

    expect(counter(admin, 'open')!.value).toBeGreaterThan(counter(lead, 'open')!.value);

    // Every row a lead sees belongs to their team; an admin's do not.
    for (const l of lead.lists) {
      for (const row of l.rows) expect(row.item.ticket.teamId).toBe('team-cs');
    }
    const adminTeams = new Set(admin.lists.flatMap((l) => l.rows.map((r) => r.item.ticket.teamId)));
    expect(adminTeams.size).toBeGreaterThan(1);

    // A trend is worth showing at supervisor/admin scope, but not to an agent.
    expect(lead.trend).toBeDefined();
    const agent = await getOverview({ id: 'l1_agent', role: 'l1_agent', teamId: 'team-cs' });
    expect((agent as TicketOverview).trend).toBeUndefined();
  });

  it('carries GGX transaction context on the rows that have it (M13)', async () => {
    const data = await getOverview({ id: 'admin', role: 'admin' });
    if (data.kind !== 'tickets') throw new Error('expected a ticket overview');

    const rows = data.lists.flatMap((l) => l.rows);
    const linked = rows.filter((r) => r.item.ticket.relatedTransactionId);
    expect(linked.length).toBeGreaterThan(0);

    const withContext = linked.filter((r) => r.transaction);
    expect(withContext.length).toBeGreaterThan(0);
    expect(withContext[0].transaction!.shipmentStatus).toBeTruthy();
    // The tracking number now rides on the list item, so every table shows it.
    expect(withContext[0].item.trackingNumber).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/);
  });

  it('gives a KB editor their publishing pipeline, not a ticket queue', async () => {
    const data = await getOverview({ id: 'kb_editor', role: 'kb_editor' });
    if (data.kind !== 'kb') throw new Error('expected a KB overview');

    expect(data.counters.map((c) => c.key)).toContain('drafts');
    expect(data.drafts.every((a) => a.status === 'draft')).toBe(true);
  });

  it("gives a customer only their own tickets, with the secure link that opens them", async () => {
    const data = await getOverview({ id: 'customer', role: 'customer', requesterId: 'req-seed-3' });
    if (data.kind !== 'requester') throw new Error('expected a requester overview');

    expect(data.tickets.length).toBeGreaterThan(0);
    for (const t of data.tickets) expect(t.ticket.requesterId).toBe('req-seed-3');

    // Awaiting-reply is on-hold specifically on the requester, and opens via token.
    expect(
      data.awaitingReply.every(
        (t) => t.ticket.status === 'on_hold' && t.ticket.holdReason === 'waiting_requester',
      ),
    ).toBe(true);
    expect(data.awaitingReply.length).toBeGreaterThan(0);
    expect(data.awaitingReply[0].accessToken).toBeTruthy();
  });

  it('returns an empty (not broken) overview for a customer with no tickets', async () => {
    const data = await getOverview({ id: 'customer', role: 'customer', requesterId: 'req-nobody' });
    if (data.kind !== 'requester') throw new Error('expected a requester overview');

    expect(data.tickets).toEqual([]);
    expect(data.awaitingReply).toEqual([]);
  });
});
