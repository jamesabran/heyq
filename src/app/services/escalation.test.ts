import { describe, expect, it } from 'vitest';
import {
  assignTicket,
  claimTicket,
  deescalateTicket,
  escalateTicket,
  getTicketDetail,
  listTickets,
  reclassifyTicket,
} from './ticketService';

describe('assignment', () => {
  it('claims an unassigned ticket and records history', async () => {
    const claimed = await claimTicket('tkt-seed-3', 'l1_agent');
    expect(claimed.assigneeId).toBe('l1_agent');
    const detail = await getTicketDetail('tkt-seed-3');
    expect(detail?.timeline.some((e) => e.type === 'assignment')).toBe(true);
  });

  it('reassigns to another agent', async () => {
    const reassigned = await assignTicket('tkt-seed-3', 'team_lead', 'l2_specialist');
    expect(reassigned.assigneeId).toBe('l2_specialist');
  });
});

describe('classification', () => {
  it('re-routes the team when the category changes and reroute is set', async () => {
    const updated = await reclassifyTicket('tkt-seed-6', 'l1_agent', {
      categoryId: 'cat-technical',
      priority: 'urgent',
      reroute: true,
    });
    expect(updated.categoryId).toBe('cat-technical');
    expect(updated.teamId).toBe('team-tech');
    expect(updated.priority).toBe('urgent');
  });
});

describe('escalation (separate from status)', () => {
  it('escalates L1 → L2 without changing workflow status, and records history', async () => {
    const before = await getTicketDetail('tkt-seed-4');
    expect(before?.ticket.status).toBe('in_progress');
    expect(before?.ticket.escalationState).toBe('none');

    const escalated = await escalateTicket('tkt-seed-4', 'team_lead', {
      reason: 'complex_case',
      note: 'Needs the specialist team to investigate.',
      toTeamId: 'team-tech',
    });

    expect(escalated.escalationState).toBe('escalated');
    expect(escalated.supportTier).toBe('L2');
    expect(escalated.teamId).toBe('team-tech');
    // Workflow status is UNCHANGED (product rule #2).
    expect(escalated.status).toBe('in_progress');
    expect(escalated.escalatedAt).toEqual(expect.any(String));

    const detail = await getTicketDetail('tkt-seed-4');
    expect(detail?.timeline.some((e) => e.type === 'escalation')).toBe(true);
  });

  it('requires a note to escalate', async () => {
    await expect(
      escalateTicket('tkt-seed-5', 'l1_agent', { reason: 'needs_specialist', note: '   ' }),
    ).rejects.toThrow(/note is required/i);
  });

  it('lists an escalated ticket in the escalated queue by state', async () => {
    // tkt-seed-4 was escalated above (same module state within this file).
    const escalated = await listTickets({ queue: 'escalated' });
    expect(escalated.map((i) => i.ticket.id)).toContain('tkt-seed-4');
  });

  it('de-escalates L2 → L1', async () => {
    const returned = await deescalateTicket('tkt-seed-4', 'team_lead', 'Resolved the complex part; back to L1.');
    expect(returned.supportTier).toBe('L1');
    expect(returned.escalationState).toBe('returned_to_l1');
  });
});
