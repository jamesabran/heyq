import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { IdentityProvider } from '../../contexts/IdentityContext';
import { routes } from '../../routes';

function renderApp(path: string, identityId = 'team_lead') {
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

describe('triage actions', () => {
  it('escalates a ticket to L2 without changing its workflow status', async () => {
    const user = userEvent.setup();
    renderApp('/app/tickets/tkt-seed-4');
    await screen.findByRole('heading', { name: /app crashes when opening bookings/i });

    // Status is In Progress before escalation.
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);

    await user.type(screen.getByLabelText('Escalation note'), 'Needs the specialist team.');
    await user.click(screen.getByRole('button', { name: /escalate to l2/i }));

    expect(await screen.findByText(/escalated to l2\. workflow status is unchanged/i)).toBeInTheDocument();
    // Workflow status is still In Progress after escalation.
    expect(screen.getAllByText('In Progress').length).toBeGreaterThan(0);
  });

  it('claims an unassigned ticket', async () => {
    const user = userEvent.setup();
    renderApp('/app/tickets/tkt-seed-3', 'l1_agent');
    await screen.findByRole('heading', { name: /rider did not arrive for pickup/i });

    const claimButton = await screen.findByRole('button', { name: /^claim$/i });
    await user.click(claimButton);

    // Once claimed by the acting agent, the Claim shortcut disappears.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^claim$/i })).not.toBeInTheDocument(),
    );
  });
});
