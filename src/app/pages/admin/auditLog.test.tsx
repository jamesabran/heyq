import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { IdentityProvider } from '../../contexts/IdentityContext';
import { routes } from '../../routes';

function renderApp(path: string, identityId: string) {
  window.localStorage.setItem('heyq-identity', identityId);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <IdentityProvider>
        <RouterProvider router={router} />
      </IdentityProvider>
    </ThemeProvider>,
  );
}

describe('audit log (M20)', () => {
  it('shows the activity trail with links back to the ticket', async () => {
    renderApp('/admin/audit', 'admin');

    expect(await screen.findByRole('heading', { name: 'Audit Log' })).toBeInTheDocument();
    // The escalation of tkt-seed-7 is in the trail, attributed to the lead who
    // did it (tkt-bp-1's escalation is also L1 → L2, so this can match more
    // than one row — the point is the trail contains it at all).
    expect((await screen.findAllByText(/escalated l1 → l2/i)).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('link', { name: 'HQ-2026-0007' }).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Carlo Reyes').length).toBeGreaterThan(0);
  });

  it('filters the trail by event type', async () => {
    const user = userEvent.setup();
    renderApp('/admin/audit', 'admin');
    await screen.findByRole('heading', { name: 'Audit Log' });

    await user.selectOptions(screen.getByRole('combobox', { name: /filter by event type/i }), 'escalation');

    const table = await screen.findByRole('table');
    const rows = within(table).getAllByRole('row').slice(1); // drop the header
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(within(row).getByText('Escalation')).toBeInTheDocument();
    }
  });

  it('records that an internal note was added, never what it said', async () => {
    renderApp('/admin/audit?category=note', 'admin');

    // All four seeded notes appear — as actions, with no bodies (M23 added two
    // more: tkt-bp-1's and tkt-internal-1's).
    expect(await screen.findAllByText('Internal note added')).toHaveLength(4);
    // The seeded note body must not surface in the audit trail (product rule #5).
    expect(screen.queryByText(/likely the crash from the 3\.2\.1 release/i)).not.toBeInTheDocument();
  });

  it('is reachable by a team lead but not by an L1 agent', async () => {
    renderApp('/admin/audit', 'team_lead');
    expect(await screen.findByRole('heading', { name: 'Audit Log' })).toBeInTheDocument();

    renderApp('/admin/audit', 'l1_agent');
    expect(await screen.findAllByText(/access restricted/i)).not.toHaveLength(0);
  });
});
