import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { IdentityProvider } from '../../contexts/IdentityContext';
import { routes } from '../../routes';

function renderApp(path: string, identityId = 'admin') {
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

describe('reporting dashboard', () => {
  it('shows operational counters and charts', async () => {
    renderApp('/app/reports');
    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeInTheDocument();
    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('SLA breached')).toBeInTheDocument();
    expect(screen.getByText('Tickets by status')).toBeInTheDocument();
  });
});

describe('notifications feed', () => {
  it('shows the agent feed with a seeded notification', async () => {
    renderApp('/app/notifications', 'l1_agent');
    expect(await screen.findByRole('heading', { name: 'Notifications' })).toBeInTheDocument();
    expect(await screen.findByText('New reply from Liza Aquino')).toBeInTheDocument();
  });
});
