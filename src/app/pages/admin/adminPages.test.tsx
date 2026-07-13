import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('admin surfaces', () => {
  it('renders the routing rules table', async () => {
    renderApp('/admin/routing');
    expect(await screen.findByRole('heading', { name: /routing rules/i })).toBeInTheDocument();
    expect(await screen.findByRole('combobox', { name: /route claims to/i })).toBeInTheDocument();
  });

  it('saves SLA config', async () => {
    const user = userEvent.setup();
    renderApp('/admin/sla');
    const input = await screen.findByLabelText(/first-response target/i);
    await user.clear(input);
    await user.type(input, '6');
    await user.click(screen.getByRole('button', { name: /save sla config/i }));
    expect(await screen.findByText(/sla config saved/i)).toBeInTheDocument();
  });

  it('lists agents with activation controls', async () => {
    renderApp('/admin/agents');
    expect(await screen.findByRole('heading', { name: 'Agents' })).toBeInTheDocument();
    expect(await screen.findByText('Alex Cruz')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /deactivate|activate/i }).length).toBeGreaterThan(0);
  });

  it('blocks a non-admin agent from admin config', async () => {
    renderApp('/admin/routing', 'l1_agent');
    expect(await screen.findByText(/access restricted/i)).toBeInTheDocument();
  });
});
