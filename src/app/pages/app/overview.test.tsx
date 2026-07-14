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

describe('Overview — the default authenticated landing (M19)', () => {
  it('lands an agent on their attention list, not a queue', async () => {
    renderApp('/app', 'l1_agent');

    expect(await screen.findByRole('heading', { name: /welcome, alex/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /needs your attention/i })).toBeInTheDocument();
    // tkt-seed-5 is urgent and first-response breached — the top of the list.
    expect(await screen.findByRole('link', { name: 'HQ-2026-0005' })).toBeInTheDocument();
    expect(screen.getByText('Assigned to me')).toBeInTheDocument();
  });

  it('deep-links a counter to the queue it counts', async () => {
    const user = userEvent.setup();
    renderApp('/app', 'l1_agent');
    await screen.findByRole('heading', { name: /welcome, alex/i });

    // The Urgent counter card links to My Queue pre-filtered to urgent. (Query by
    // link, not text — "Urgent" also appears as a priority badge on the rows.)
    await user.click(screen.getByRole('link', { name: /urgent/i }));

    expect(await screen.findByRole('heading', { name: 'My Queue' })).toBeInTheDocument();
    const priority = await screen.findByRole('combobox', { name: /filter by priority/i });
    expect(priority).toHaveValue('urgent');
    // The urgent one is listed; the high-priority one is filtered out.
    expect(await screen.findByRole('link', { name: 'HQ-2026-0005' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'HQ-2026-0004' })).not.toBeInTheDocument();
  });

  it('scopes a supervisor to their own team, with one team trend', async () => {
    renderApp('/app', 'team_lead');
    // Scope to the main landmark — the sidebar carries the same words as the counters.
    const main = within(await screen.findByRole('main'));

    expect(await main.findByRole('heading', { name: /welcome, carlo/i })).toBeInTheDocument();
    expect(await main.findByRole('heading', { name: /sla breached & at risk/i })).toBeInTheDocument();
    // The one trend a supervisor gets, scoped to their team.
    expect(await main.findByText('Team tickets by status')).toBeInTheDocument();

    // Carlo leads team-cs; the only escalated ticket is in team-claims — so his
    // escalation counter is 0 and the Escalations list is dropped entirely.
    expect(main.getByRole('link', { name: 'Escalated 0' })).toBeInTheDocument();
    expect(main.queryByRole('heading', { name: /^escalations$/i })).not.toBeInTheDocument();
  });

  it('widens an admin to every team, escalations included', async () => {
    renderApp('/app', 'admin');
    const main = within(await screen.findByRole('main'));

    expect(await main.findByRole('heading', { name: /welcome, ella/i })).toBeInTheDocument();
    expect(await main.findByText('Tickets by team')).toBeInTheDocument();
    // The team-claims escalation a team-cs lead can't see surfaces here. It is
    // both breached and escalated, so it earns a row in each list.
    expect(await main.findByRole('heading', { name: /^escalations$/i })).toBeInTheDocument();
    expect(main.getAllByRole('link', { name: 'HQ-2026-0007' }).length).toBeGreaterThan(0);
  });

  it('gives a KB editor drafts instead of ticket queues', async () => {
    renderApp('/app', 'kb_editor');

    expect(await screen.findByRole('heading', { name: /welcome, dana/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /drafts awaiting publish/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /new article/i })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /needs your attention/i })).not.toBeInTheDocument();
  });

  it("gives a customer their own tickets, opening through the secure link", async () => {
    renderApp('/app', 'customer');

    expect(await screen.findByRole('heading', { name: /welcome, nadia/i })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: /your tickets/i })).toBeInTheDocument();

    // HQ-2026-0008 is pending her reply — the row opens the portal by token,
    // never by reference (product rule #6), and no agent surface is offered.
    const ref = await screen.findByRole('link', { name: 'HQ-2026-0008' });
    expect(ref).toHaveAttribute('href', '/t/demo-token-invoice');
    expect(screen.getByText(/waiting on you/i)).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /new ticket/i })).not.toBeInTheDocument();
  });
});
