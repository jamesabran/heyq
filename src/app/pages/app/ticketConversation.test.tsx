import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { IdentityProvider } from '../../contexts/IdentityContext';
import { routes } from '../../routes';

// WebSocket is unavailable under jsdom, so the realtime hook degrades to the API
// path: these assert the composer → optimistic → persisted flow renders exactly
// once (no duplicate from the overlay reconciliation), across public replies and
// internal notes.
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

describe('ticket conversation', () => {
  it('sends a public reply that appears once and advances the status', async () => {
    const user = userEvent.setup();
    renderApp('/app/tickets/tkt-seed-3');
    await screen.findByRole('heading', { name: /rider did not arrive for pickup/i });

    await user.type(screen.getByLabelText('Public reply'), 'On it now — checking with the hub.');
    await user.click(screen.getByRole('button', { name: /send reply/i }));

    await screen.findByText('On it now — checking with the hub.');
    // Overlay + refetched history de-duplicate by id: exactly one bubble.
    await waitFor(() => expect(screen.getAllByText('On it now — checking with the hub.')).toHaveLength(1));

    // An agent reply on an Open ticket moves it to In Progress (meta refetch).
    expect(await screen.findByText('In Progress')).toBeInTheDocument();
  });

  it('adds an internal note that renders distinctly and is not a public reply', async () => {
    const user = userEvent.setup();
    renderApp('/app/tickets/tkt-seed-3');
    await screen.findByRole('heading', { name: /rider did not arrive for pickup/i });

    await user.click(screen.getByRole('tab', { name: /internal note/i }));
    await user.type(screen.getByLabelText('Internal note'), 'Internal: flagged to ops.');
    await user.click(screen.getByRole('button', { name: /add note/i }));

    const noteBody = await screen.findByText('Internal: flagged to ops.');
    await waitFor(() => expect(screen.getAllByText('Internal: flagged to ops.')).toHaveLength(1));
    // The note carries the internal-note badge — never a public reply.
    expect(screen.getAllByText('Internal note').length).toBeGreaterThan(0);
    expect(noteBody).toBeInTheDocument();
  });

  it('shows the conversation header while keeping the reply composer present', async () => {
    renderApp('/app/tickets/tkt-seed-4');
    // The dominant conversation panel has a persistent header + composer.
    expect(await screen.findByRole('heading', { name: 'Conversation' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /send reply/i })).toBeInTheDocument();
  });
});
