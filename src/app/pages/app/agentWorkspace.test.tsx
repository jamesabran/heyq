import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { IdentityProvider } from '../../contexts/IdentityContext';
import { routes } from '../../routes';

function renderApp(path: string, identityId = 'l1_agent') {
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

describe('agent workspace', () => {
  it('shows the agent\'s assigned tickets in My Queue', async () => {
    renderApp('/app');
    expect(await screen.findByRole('heading', { name: 'My Queue' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'HQ-2026-0004' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'HQ-2026-0005' })).toBeInTheDocument();
  });

  it('lists escalated tickets by escalation state', async () => {
    renderApp('/app/escalated', 'l2_specialist');
    expect(await screen.findByRole('heading', { name: /escalated tickets/i })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'HQ-2026-0007' })).toBeInTheDocument();
  });

  it('shows internal notes in the agent detail view', async () => {
    renderApp('/app/tickets/tkt-seed-4');
    expect(await screen.findByRole('heading', { name: /app crashes when opening bookings/i })).toBeInTheDocument();
    // The note body (unique) confirms the internal note renders in the agent view.
    expect(screen.getByText(/likely the crash from the 3\.2\.1 release/i)).toBeInTheDocument();
    // "Internal note" appears as both the note badge and the composer tab.
    expect(screen.getAllByText('Internal note').length).toBeGreaterThan(0);
  });

  it('resolves a ticket from the detail actions', async () => {
    const user = userEvent.setup();
    renderApp('/app/tickets/tkt-seed-5');
    await screen.findByRole('heading', { name: /cannot log in to my account/i });

    await user.click(screen.getByRole('button', { name: /resolve ticket/i }));

    expect(await screen.findByText(/this ticket is resolved/i)).toBeInTheDocument();
  });
});
