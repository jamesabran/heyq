import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ThemeProvider } from '../contexts/ThemeContext';
import { IdentityProvider } from '../contexts/IdentityContext';
import { routes } from '../routes';

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

describe('ticket submission', () => {
  it('submits a ticket and shows a reference with a secure portal link', async () => {
    const user = userEvent.setup();
    renderApp('/contact');

    await user.type(await screen.findByLabelText('Name'), 'Jamie Lopez');
    await user.type(screen.getByLabelText('Email'), 'jamie@example.com');
    await user.selectOptions(screen.getByLabelText('Concern type'), 'General inquiry');
    await user.type(screen.getByLabelText('Subject'), 'Question about my booking');
    await user.type(screen.getByLabelText('Description'), 'I need help with a recent booking.');

    await user.click(screen.getByRole('button', { name: /submit ticket/i }));

    expect(await screen.findByText(/ticket submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/HQ-2026-\d{4}/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /view your ticket/i })).toBeInTheDocument();
  });

  it('blocks submission when required fields are missing', async () => {
    const user = userEvent.setup();
    renderApp('/contact');
    await user.click(await screen.findByRole('button', { name: /submit ticket/i }));
    expect(await screen.findByText(/your name is required/i)).toBeInTheDocument();
    expect(screen.queryByText(/ticket submitted/i)).not.toBeInTheDocument();
  });
});

describe('requester portal', () => {
  it('opens a seeded ticket via its access token', async () => {
    renderApp('/t/demo-token-parcel');
    expect(await screen.findByText('Where is my parcel?')).toBeInTheDocument();
    expect(screen.getByText('HQ-2026-0001')).toBeInTheDocument();
  });

  it('rejects a ticket reference used in place of a token', async () => {
    renderApp('/t/HQ-2026-0001');
    expect(await screen.findByText(/ticket link not found/i)).toBeInTheDocument();
  });

  it('moves the ticket to In Progress when the requester replies', async () => {
    const user = userEvent.setup();
    renderApp('/t/demo-token-parcel');
    await screen.findByText('Where is my parcel?');

    await user.type(screen.getByLabelText(/add a reply/i), 'Here is my tracking number: GGX-123.');
    await user.click(screen.getByRole('button', { name: /send reply/i }));

    expect(await screen.findByText('In Progress')).toBeInTheDocument();
    expect(await screen.findByText(/here is my tracking number/i)).toBeInTheDocument();
  });
});
