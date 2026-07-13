import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { IdentityProvider } from '../../contexts/IdentityContext';
import { routes } from '../../routes';

function renderApp(path: string) {
  window.localStorage.setItem('heyq-identity', 'guest');
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  return render(
    <ThemeProvider>
      <IdentityProvider>
        <RouterProvider router={router} />
      </IdentityProvider>
    </ThemeProvider>,
  );
}

describe('help center', () => {
  it('renders featured articles and categories on the home page', async () => {
    renderApp('/help');
    expect(await screen.findByText('How to book a delivery')).toBeInTheDocument();
    expect(await screen.findByText('Getting Started')).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: /search the help center/i })).toBeInTheDocument();
  });

  it('renders an article with last-updated and related articles', async () => {
    renderApp('/help/a/how-to-book-a-delivery');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'How to book a delivery' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/last updated/i)).toBeInTheDocument();
    expect(await screen.findByText('Related articles')).toBeInTheDocument();
  });

  it('does not expose an internal article on the public article route', async () => {
    renderApp('/help/a/internal-escalation-runbook');
    expect(await screen.findByText(/article not available/i)).toBeInTheDocument();
    expect(screen.queryByText(/escalation path/i)).not.toBeInTheDocument();
  });

  it('lists a category with its articles', async () => {
    renderApp('/help/c/getting-started');
    expect(await screen.findByRole('heading', { level: 1, name: 'Getting Started' })).toBeInTheDocument();
    expect(await screen.findByText('Create your GGX account')).toBeInTheDocument();
  });

  it('shows search results for a query and none for internal-only terms', async () => {
    renderApp('/help/search?q=booking');
    expect(await screen.findByText(/results? for/i)).toBeInTheDocument();

    renderApp('/help/search?q=runbook');
    expect(await screen.findByText(/no results found/i)).toBeInTheDocument();
  });
});
