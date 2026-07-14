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
    renderApp('/app/mine');
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

  it('shows the Concern Type column in the queue (M15)', async () => {
    renderApp('/app/mine');
    await screen.findByRole('heading', { name: 'My Queue' });
    // Column header + a seeded concern value (tkt-seed-4 → Booking issue).
    expect(screen.getByRole('columnheader', { name: /concern type/i })).toBeInTheDocument();
    expect(screen.getAllByText('Booking issue').length).toBeGreaterThan(0);
  });

  it('shows the GGX tracking number as its own column', async () => {
    renderApp('/app/team');
    await screen.findByRole('heading', { name: 'Team Tickets' });

    expect(screen.getByRole('columnheader', { name: /tracking/i })).toBeInTheDocument();
    // tkt-seed-3 links TXN-2003.
    expect(await screen.findByText('ZTQZ-F924-ZZ0P')).toBeInTheDocument();
  });

  it('finds a ticket by a partial tracking number from the queue search', async () => {
    const user = userEvent.setup();
    renderApp('/app/search', 'admin');
    await screen.findByRole('heading', { name: 'Search' });

    // A fragment of TXN-2005's number (KP3D-9VXA-R60T) — enough to find HQ-2026-0007.
    await user.type(screen.getByRole('searchbox', { name: /search tickets/i }), '9vxa');

    expect(await screen.findByRole('link', { name: 'HQ-2026-0007' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'HQ-2026-0004' })).not.toBeInTheDocument();
  });

  it('puts a ticket on hold with a reason, and the queue shows On Hold', async () => {
    const user = userEvent.setup();
    renderApp('/app/tickets/tkt-seed-4');
    await screen.findByRole('heading', { name: /app crashes when opening bookings/i });

    await user.selectOptions(screen.getByRole('combobox', { name: /hold reason/i }), 'waiting_third_party');
    await user.click(screen.getByRole('button', { name: /put on hold/i }));

    expect(await screen.findByText(/on hold — waiting for third party/i)).toBeInTheDocument();
  });

  it('renders the GGX transaction panel with its statuses (M13)', async () => {
    // tkt-seed-2 links TXN-2002 (delivered, paid, remittance pending); admin sees all.
    renderApp('/app/tickets/tkt-seed-2', 'admin');
    await screen.findByRole('heading', { name: /cod remittance not received/i });
    expect(await screen.findByText('GGX Transaction')).toBeInTheDocument();
    // Tracking number + independent statuses confirm the panel resolved.
    expect(await screen.findByText('D4XV-A7ND-SQCZ')).toBeInTheDocument();
    expect(screen.getAllByText('Delivered').length).toBeGreaterThan(0); // shipment
    expect(screen.getByText('Pending')).toBeInTheDocument(); // remittance
  });

  it('opens the internal ticket creation form (M16)', async () => {
    renderApp('/app/tickets/new');
    expect(await screen.findByRole('heading', { name: /new internal ticket/i })).toBeInTheDocument();
    // Requester notifications are off by default until an external customer is added.
    expect(screen.getByText(/requester notifications are off for internal tickets/i)).toBeInTheDocument();
  });

  it('resolves a ticket from the detail actions', async () => {
    const user = userEvent.setup();
    renderApp('/app/tickets/tkt-seed-5');
    await screen.findByRole('heading', { name: /cannot log in to my account/i });

    await user.click(screen.getByRole('button', { name: /resolve ticket/i }));

    expect(await screen.findByText(/this ticket is resolved/i)).toBeInTheDocument();
  });
});
