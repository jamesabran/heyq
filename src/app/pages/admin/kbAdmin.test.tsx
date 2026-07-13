import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { IdentityProvider } from '../../contexts/IdentityContext';
import { routes } from '../../routes';

function renderApp(path: string, identityId = 'kb_editor') {
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

describe('KB administration', () => {
  it('lists every article, including drafts and internal ones', async () => {
    renderApp('/admin/kb');
    expect(await screen.findByRole('heading', { name: 'Knowledge Base' })).toBeInTheDocument();
    expect(await screen.findByText('Upcoming feature notes')).toBeInTheDocument(); // draft
    expect(screen.getByText('Internal escalation runbook')).toBeInTheDocument(); // internal
    expect(screen.getByRole('link', { name: /new article/i })).toBeInTheDocument();
  });

  it('publishes the draft article from the list', async () => {
    const user = userEvent.setup();
    renderApp('/admin/kb');
    const publishBtn = await screen.findByRole('button', { name: /^publish$/i });
    await user.click(publishBtn);
    // The single draft flips to published; no Publish action remains.
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^publish$/i })).not.toBeInTheDocument(),
    );
  });

  it('blocks a guest from the KB admin area', async () => {
    renderApp('/admin/kb', 'guest');
    expect(await screen.findByText(/access restricted/i)).toBeInTheDocument();
  });
});
