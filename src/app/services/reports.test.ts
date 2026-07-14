import { describe, expect, it } from 'vitest';
import { getSummary } from './reportsService';

describe('reports summary', () => {
  it('counts the full ticket dataset', async () => {
    const s = await getSummary();
    expect(s.total).toBeGreaterThanOrEqual(8);
    const byStatusTotal = s.byStatus.reduce((n, b) => n + b.count, 0);
    expect(byStatusTotal).toBe(s.total);
    expect(s.escalated).toBeGreaterThanOrEqual(1); // tkt-seed-7
    expect(s.unassigned).toBeGreaterThanOrEqual(1);
    expect(s.slaBreached).toBeGreaterThanOrEqual(1);
  });

  it('scopes the summary to a team', async () => {
    const cs = await getSummary('team-cs');
    expect(cs.byTeam.every((b) => b.key === 'team-cs')).toBe(true);
    expect(cs.total).toBeLessThan((await getSummary()).total);
  });
});
