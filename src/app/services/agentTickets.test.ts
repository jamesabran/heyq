import { describe, expect, it } from 'vitest';
import {
  addInternalNote,
  getTicketDetail,
  listTickets,
  resolveTicket,
} from './ticketService';
import { resolveAccessToken } from './requesterService';
import { listMessages } from './ticketService';

describe('agent queues', () => {
  it('scopes "mine" to the viewer and "team" to the viewer team', async () => {
    const mine = await listTickets({ queue: 'mine', viewerId: 'l1_agent', viewerTeamId: 'team-cs' });
    expect(mine.length).toBeGreaterThan(0);
    expect(mine.every((i) => i.ticket.assigneeId === 'l1_agent')).toBe(true);

    const team = await listTickets({ queue: 'team', viewerId: 'l1_agent', viewerTeamId: 'team-cs' });
    expect(team.every((i) => i.ticket.teamId === 'team-cs')).toBe(true);
  });

  it('lists unassigned tickets with no assignee', async () => {
    const unassigned = await listTickets({ queue: 'unassigned', viewerTeamId: undefined });
    expect(unassigned.every((i) => !i.ticket.assigneeId)).toBe(true);
  });

  it('filters the escalated queue by escalation state, not status', async () => {
    const escalated = await listTickets({ queue: 'escalated' });
    expect(escalated.length).toBeGreaterThan(0);
    expect(escalated.every((i) => i.ticket.escalationState !== 'none')).toBe(true);
    // The seeded escalated ticket keeps a non-terminal workflow status.
    expect(escalated.some((i) => i.ticket.status === 'in_progress')).toBe(true);
  });

  it('surfaces at-risk / breached tickets in the SLA queue', async () => {
    const sla = await listTickets({ queue: 'sla' });
    expect(sla.length).toBeGreaterThan(0);
  });
});

describe('agent ticket detail and actions', () => {
  it('composes context, messages, notes, timeline, and SLA', async () => {
    const view = await getTicketDetail('tkt-seed-4');
    expect(view?.assigneeName).toBe('Alex Cruz');
    expect(view?.notes.length).toBeGreaterThan(0);
    expect(view?.messages.every((m) => m.visibility === 'public')).toBe(true);
    expect(view?.timeline.length).toBeGreaterThan(0);
    expect(view?.sla.firstResponse.state).toBe('met');
  });

  it('adds an internal note that never reaches the requester portal', async () => {
    await addInternalNote('tkt-seed-4', 'l1_agent', 'SECRET-NOTE-XYZ internal only');
    // Internal notes are a separate type; the public message list excludes them.
    const publicMessages = await listMessages('tkt-seed-4');
    expect(publicMessages.some((m) => m.body.includes('SECRET-NOTE-XYZ'))).toBe(false);
    // The portal view resolves via token and exposes only public messages.
    const portal = await resolveAccessToken('demo-token-app');
    expect(portal?.ticket.id).toBe('tkt-seed-4');
    const portalMessages = await listMessages(portal!.ticket.id);
    expect(portalMessages.some((m) => m.body.includes('SECRET-NOTE-XYZ'))).toBe(false);
  });

  it('resolves a ticket, setting status and resolution type', async () => {
    const ticket = await resolveTicket('tkt-seed-3', 'l1_agent', 'solved', 'Rider re-dispatched.');
    expect(ticket.status).toBe('resolved');
    expect(ticket.resolutionType).toBe('solved');
    expect(ticket.resolvedAt).toEqual(expect.any(String));
  });
});
