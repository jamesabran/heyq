import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ThemeProvider } from '../contexts/ThemeContext';
import { IdentityProvider } from '../contexts/IdentityContext';
import { routes } from '../routes';

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

describe('accessibility landmarks', () => {
  it('provides a skip link targeting the main landmark (app shell)', async () => {
    renderApp('/app');
    const skip = screen.getByRole('link', { name: /skip to content/i });
    expect(skip).toHaveAttribute('href', '#main-content');
    expect(document.querySelector('main#main-content')).toBeInTheDocument();
  });

  it('provides a skip link on public pages', async () => {
    renderApp('/help');
    expect(screen.getByRole('link', { name: /skip to content/i })).toBeInTheDocument();
    expect(document.querySelector('main#main-content')).toBeInTheDocument();
  });

  it('exposes the nav toggle state via aria-expanded', async () => {
    renderApp('/app');
    expect(screen.getByRole('button', { name: /toggle navigation/i })).toHaveAttribute('aria-expanded', 'false');
  });
});
