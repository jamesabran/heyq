import { describe, expect, it } from 'vitest';
import { listAuditActors, listAuditEntries } from './auditService';
import { addInternalNote, escalateTicket } from './ticketService';

describe('auditService (M20)', () => {
  it('unifies every history into one newest-first trail', async () => {
    const entries = await listAuditEntries();

    // All five sources are represented.
    const categories = new Set(entries.map((e) => e.category));
    expect(categories).toEqual(new Set(['ticket', 'assignment', 'escalation', 'note', 'kb']));

    // Newest first.
    const timestamps = entries.map((e) => e.timestamp);
    expect([...timestamps].sort((a, b) => b.localeCompare(a))).toEqual(timestamps);

    // Ticket-side entries carry the reference so the row can link to the ticket.
    const status = entries.find((e) => e.category === 'ticket');
    expect(status?.ticketRef).toMatch(/^HQ-\d{4}-\d{4}$/);
  });

  it('never exposes an internal note body — only that a note was added', async () => {
    await addInternalNote('tkt-seed-3', 'l1_agent', 'Rider dispatch confirmed by the hub.');
    const entries = await listAuditEntries({ category: 'note' });

    expect(entries.length).toBeGreaterThan(0);
    for (const e of entries) {
      expect(e.action).toBe('Internal note added');
    }
    // The body appears nowhere in the trail (product rule #5).
    const serialized = JSON.stringify(await listAuditEntries());
    expect(serialized).not.toContain('Rider dispatch confirmed by the hub.');
  });

  it('filters by category, actor, and search', async () => {
    const escalations = await listAuditEntries({ category: 'escalation' });
    expect(escalations.every((e) => e.category === 'escalation')).toBe(true);

    const byActor = await listAuditEntries({ actorId: 'l2_specialist' });
    expect(byActor.length).toBeGreaterThan(0);
    expect(byActor.every((e) => e.actorId === 'l2_specialist')).toBe(true);

    const byRef = await listAuditEntries({ search: 'HQ-2026-0007' });
    expect(byRef.length).toBeGreaterThan(0);
    expect(byRef.every((e) => e.ticketRef === 'HQ-2026-0007')).toBe(true);
  });

  it('names the KB editor rather than leaking her raw id', async () => {
    const kb = await listAuditEntries({ category: 'kb' });
    expect(kb.length).toBeGreaterThan(0);
    expect(kb[0].actorName).toBe('KB Editor');
    expect(kb[0].articleTitle).toBeTruthy();
  });

  it('picks up a new action as soon as it happens', async () => {
    const before = await listAuditEntries({ search: 'HQ-2026-0006' });

    await escalateTicket('tkt-seed-6', 'team_lead', {
      toTeamId: 'team-claims',
      reason: 'high_value',
      note: 'Damaged high-value parcel — specialist review.',
    });

    // Escalating to another team records both the escalation and the re-route,
    // so assert the escalation is present rather than that it sorts first.
    const after = await listAuditEntries({ search: 'HQ-2026-0006' });
    expect(after.length).toBeGreaterThan(before.length);

    const escalation = after.find((e) => e.category === 'escalation');
    expect(escalation?.actorName).toBe('Carlo Reyes');
    expect(escalation?.action).toMatch(/escalated l1 → l2/i);
  });

  it('lists the actors that actually appear in the trail', async () => {
    const actors = await listAuditActors();
    const ids = actors.map((a) => a.id);

    expect(ids).toContain('l1_agent');
    expect(ids).toContain('system');
    // Nobody who never acted shows up as a filter option.
    expect(ids).not.toContain('guest');
  });
});
