import { describe, expect, it } from 'vitest';
import {
  addCategory,
  setAgentActive,
  setCategoryTeam,
  updateSlaConfig,
} from './adminService';
import { createTicket, getTicketById, getTicketDetail } from './ticketService';
import { listCategories } from './catalogService';

describe('routing configuration flows into submission', () => {
  it('routes new tickets to the team set by the routing rule', async () => {
    await setCategoryTeam('cat-technical', 'team-claims');
    const { ticket } = await createTicket({
      name: 'Test', email: 't@example.com', subject: 'x', description: 'y', categoryId: 'cat-technical',
    });
    expect(ticket.teamId).toBe('team-claims');
  });
});

describe('SLA config flows into SLA computation', () => {
  it('changes a ticket SLA state when targets change', async () => {
    // tkt-seed-5 has no first response and an old createdAt → breached at 4h.
    const before = await getTicketDetail('tkt-seed-5');
    expect(before?.sla.firstResponse.state).toBe('breached');

    await updateSlaConfig({ firstResponseHours: 1000 });
    const after = await getTicketDetail('tkt-seed-5');
    expect(after?.sla.firstResponse.state).toBe('on_track');
  });
});

describe('agents & taxonomy', () => {
  it('deactivates an agent', async () => {
    const agent = await setAgentActive('l1_agent', false);
    expect(agent.active).toBe(false);
  });

  it('adds a concern category available to routing/taxonomy', async () => {
    const created = await addCategory('Promotions', 'team-cs');
    const all = await listCategories();
    expect(all.map((c) => c.id)).toContain(created.id);
    expect(created.defaultTeamId).toBe('team-cs');

    // The new category routes correctly on submission.
    const { ticket } = await createTicket({
      name: 'A', email: 'a@example.com', subject: 's', description: 'd', categoryId: created.id,
    });
    expect((await getTicketById(ticket.id))?.teamId).toBe('team-cs');
  });
});
