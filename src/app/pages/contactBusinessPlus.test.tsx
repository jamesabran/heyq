import { afterEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ThemeProvider } from '../contexts/ThemeContext';
import { IdentityProvider } from '../contexts/IdentityContext';
import { routes } from '../routes';
import { setBusinessPlusProviderDown } from '../services/orderProvider';

function renderApp(path: string, identityId = 'customer') {
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

afterEach(async () => {
  await setBusinessPlusProviderDown(false);
});

describe('Business+ order selection on the contact form (M22)', () => {
  it('shows the authorized orders with prefilled contact details', async () => {
    renderApp('/contact');

    expect(await screen.findByText(/link a ggx business\+ order/i)).toBeInTheDocument();
    expect(screen.getByText(/acme retail corp/i)).toBeInTheDocument();

    // Only Acme's orders — never Zenith's.
    expect(await screen.findByText('Q7PL-2MRX-J90A')).toBeInTheDocument();
    expect(screen.queryByText('V2WM-7JXB-F61S')).not.toBeInTheDocument();

    // Contact details prefilled from the signed-in requester, still editable.
    expect(await screen.findByLabelText('Name')).toHaveValue('Nadia Cruz');
    expect(screen.getByLabelText('Email')).toHaveValue('nadia.cruz@example.com');
  });

  it('submits a ticket linked to the selected order', async () => {
    const user = userEvent.setup();
    renderApp('/contact');

    await screen.findByText('Q7PL-2MRX-J90A');
    await user.click(screen.getByRole('radio', { name: /order bp-ord-7001/i }));

    await user.selectOptions(await screen.findByLabelText('Concern type'), 'Delivery');
    await user.type(screen.getByLabelText('Subject'), 'Recipient did not get the parcel');
    await user.type(screen.getByLabelText('Description'), 'Marked out for delivery since yesterday.');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByRole('heading', { name: /ticket submitted/i })).toBeInTheDocument();
    expect(screen.getByText(/HQ-2026-\d{4}/)).toBeInTheDocument();
  });

  it('preselects an authorized order arriving via the handoff deep link', async () => {
    renderApp('/contact?order=BP-ORD-7003');

    await screen.findByText('Y6TN-4QSV-D28E');
    expect(await screen.findByRole('radio', { name: /order bp-ord-7003/i })).toBeChecked();
  });

  it("refuses a deep link to another organization's order", async () => {
    renderApp('/contact?order=BP-ORD-8001');

    expect(await screen.findByText(/that order isn't available/i)).toBeInTheDocument();
    // Nothing got selected on their behalf.
    expect(screen.getByRole('radio', { name: /no order/i })).toBeChecked();
  });

  it('degrades to the no-order path when the provider is down', async () => {
    await setBusinessPlusProviderDown(true);
    const user = userEvent.setup();
    renderApp('/contact');

    expect(await screen.findByText(/ggx business\+ is unreachable/i)).toBeInTheDocument();

    // The requester still gets help: the plain submission works.
    await user.type(await screen.findByLabelText('Subject'), 'Cannot reach my account rep');
    await user.selectOptions(screen.getByLabelText('Concern type'), 'General inquiry');
    await user.type(screen.getByLabelText('Description'), 'Please call me back.');
    await user.click(screen.getByRole('button', { name: /submit/i }));

    expect(await screen.findByRole('heading', { name: /ticket submitted/i })).toBeInTheDocument();
  });

  it('keeps the manual flow untouched for guests', async () => {
    renderApp('/contact', 'guest');

    expect(await screen.findByRole('heading', { name: /submit a ticket/i })).toBeInTheDocument();
    expect(screen.queryByText(/link a ggx business\+ order/i)).not.toBeInTheDocument();
  });
});

describe('linked-order context in the requester portal (M22)', () => {
  it('shows the saved snapshot, never agent-side details', async () => {
    renderApp('/t/demo-token-bporder', 'customer');

    expect(await screen.findByRole('heading', { name: /recipient reports the parcel has not moved/i })).toBeInTheDocument();
    expect(await screen.findByText(/linked ggx order/i)).toBeInTheDocument();
    expect(screen.getByText('BP-ORD-7003')).toBeInTheDocument();
    expect(screen.getByText('Y6TN-4QSV-D28E')).toBeInTheDocument();
    // Snapshot status at submission, not the live (delivered) record.
    expect(screen.getByText('In transit')).toBeInTheDocument();
    // No assignee, team internals, or "check live" controls leak into the portal.
    expect(screen.queryByRole('button', { name: /check live status/i })).not.toBeInTheDocument();
  });
});
