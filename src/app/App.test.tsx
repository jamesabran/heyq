import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ThemeProvider } from './contexts/ThemeContext';
import { IdentityProvider } from './contexts/IdentityContext';
import { routes } from './routes';

function renderApp(path: string, identityId?: string) {
  if (identityId) window.localStorage.setItem('heyq-identity', identityId);
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <IdentityProvider>
        <RouterProvider router={router} />
      </IdentityProvider>
    </ThemeProvider>,
  );
}

describe('application shell', () => {
  it('renders the brand mark, disabled brand control, and identity switcher', () => {
    renderApp('/app', 'admin');
    const header = screen.getByRole('banner');
    expect(within(header).getByText('HeyQ')).toBeInTheDocument();

    const brandControl = screen.getByRole('button', { name: /ggx/i });
    expect(brandControl).toBeDisabled();

    expect(screen.getByRole('combobox', { name: /simulated identity/i })).toBeInTheDocument();
  });

  it('redirects the index route to the agent workspace', () => {
    renderApp('/', 'admin');
    expect(screen.getByRole('heading', { name: /my queue/i })).toBeInTheDocument();
  });
});

describe('role-based navigation gating', () => {
  it('shows the Administration section to an admin', () => {
    renderApp('/app', 'admin');
    const nav = screen.getByRole('navigation', { name: /primary/i });
    expect(within(nav).getByText('Administration')).toBeInTheDocument();
    expect(within(nav).getByRole('link', { name: /agents/i })).toBeInTheDocument();
  });

  it('hides the Administration section from an L1 agent but keeps the workspace', () => {
    renderApp('/app', 'l1_agent');
    const nav = screen.getByRole('navigation', { name: /primary/i });
    expect(within(nav).getByText('Agent Workspace')).toBeInTheDocument();
    expect(within(nav).queryByText('Administration')).not.toBeInTheDocument();
    expect(within(nav).queryByText('Supervisor')).not.toBeInTheDocument();
  });

  it('reveals Supervisor + Audit to a team lead but hides admin-only items', () => {
    renderApp('/app', 'team_lead');
    const nav = screen.getByRole('navigation', { name: /primary/i });
    expect(within(nav).getByText('Supervisor')).toBeInTheDocument();
    // Team leads can view the audit log, so the Administration section appears…
    expect(within(nav).getByRole('link', { name: /audit log/i })).toBeInTheDocument();
    // …but admin-only configuration items do not.
    expect(within(nav).queryByRole('link', { name: /^agents$/i })).not.toBeInTheDocument();
    expect(within(nav).queryByRole('link', { name: /routing rules/i })).not.toBeInTheDocument();
  });

  it('updates visible navigation when the identity is switched', async () => {
    const user = userEvent.setup();
    renderApp('/app', 'admin');
    const nav = screen.getByRole('navigation', { name: /primary/i });
    expect(within(nav).getByText('Administration')).toBeInTheDocument();

    await user.selectOptions(
      screen.getByRole('combobox', { name: /simulated identity/i }),
      'l1_agent',
    );
    expect(within(nav).queryByText('Administration')).not.toBeInTheDocument();
    expect(within(nav).getByText('Agent Workspace')).toBeInTheDocument();
  });
});

describe('route guards', () => {
  it('blocks a guest from the admin area with an access-restricted notice', () => {
    renderApp('/admin/agents', 'guest');
    expect(screen.getByText(/access restricted/i)).toBeInTheDocument();
    expect(screen.queryByText('Placeholder')).not.toBeInTheDocument();
  });

  it('allows an admin into the admin area', () => {
    renderApp('/admin/agents', 'admin');
    expect(screen.getByRole('heading', { name: 'Agents' })).toBeInTheDocument();
  });

  it('resolves the :id param on the dynamic ticket route', async () => {
    renderApp('/app/tickets/tkt-seed-1', 'admin');
    // The detail page loads the ticket named by the route param.
    expect(await screen.findByRole('heading', { name: /where is my parcel/i })).toBeInTheDocument();
    expect(screen.getAllByText('HQ-2026-0001').length).toBeGreaterThan(0);
  });
});
