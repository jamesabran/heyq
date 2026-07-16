import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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

describe('public TOS & policies', () => {
  it('lists published legal documents and hides drafts', async () => {
    renderApp('/help/legal');
    expect(await screen.findByRole('heading', { level: 1, name: /terms of service & policies/i })).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'General Terms of Service' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Annex A — Privacy Policy' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Annex D — Refunds & Claims Policy' })).toBeInTheDocument();
    // The draft annex must never reach the public index.
    expect(screen.queryByText(/data processing addendum/i)).not.toBeInTheDocument();
  });

  it('does not expose a draft annex on its public route', async () => {
    renderApp('/help/legal/data-processing-addendum');
    expect(await screen.findByText(/document not available/i)).toBeInTheDocument();
    expect(screen.queryByText(/controller-to-processor/i)).not.toBeInTheDocument();
  });

  it('renders a legal document with its last-updated date and contents list', async () => {
    renderApp('/help/legal/general-terms-of-service');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'General Terms of Service' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/last updated/i)).toBeInTheDocument();

    const toc = screen.getByRole('navigation', { name: /on this page/i });
    expect(within(toc).getByRole('link', { name: 'Liability' })).toHaveAttribute('href', '#liability');
  });

  it('anchors headings so a section link has somewhere to land', async () => {
    renderApp('/help/legal/privacy-policy');
    const heading = await screen.findByRole('heading', { name: 'Data we collect' });
    // The id other documents target with /help/legal/privacy-policy#data-we-collect.
    expect(heading).toHaveAttribute('id', 'data-we-collect');
  });

  it('preserves rich formatting: headings, nested lists, and numbering', async () => {
    renderApp('/help/legal/acceptable-use-policy');
    expect(await screen.findByRole('heading', { name: 'Prohibited items' })).toBeInTheDocument();

    // Unordered prohibited-items list.
    const explosives = screen.getByText(/explosives, flammable gases/i);
    expect(explosives.closest('ul')).toBeInTheDocument();

    // Ordered restricted-items list stays ordered.
    const lithium = screen.getByText(/lithium batteries/i);
    expect(lithium.closest('ol')).toBeInTheDocument();
  });

  it('links a legal document to another document and to a specific section', async () => {
    renderApp('/help/legal/general-terms-of-service');
    await screen.findByRole('heading', { level: 1, name: 'General Terms of Service' });

    // The TOS cites the same annex both as a whole document and at a specific
    // section, under the same link text — both forms must survive.
    const aupHrefs = screen
      .getAllByRole('link', { name: 'Acceptable Use Policy' })
      .map((link) => link.getAttribute('href'));
    expect(aupHrefs).toContain('/help/legal/acceptable-use-policy');
    expect(aupHrefs).toContain('/help/legal/acceptable-use-policy#prohibited-items');
    // Cross-document section link.
    const claimsHrefs = screen
      .getAllByRole('link', { name: 'Refunds & Claims Policy' })
      .map((link) => link.getAttribute('href'));
    expect(claimsHrefs).toContain('/help/legal/refunds-and-claims-policy#liability-caps');
    // Same-document section link. The contents list points at the same anchor,
    // so both occurrences should agree.
    screen
      .getAllByRole('link', { name: 'Annexes to these terms' })
      .forEach((link) => expect(link).toHaveAttribute('href', '#annexes-to-these-terms'));
  });

  it('navigates through an internal link without leaving the app', async () => {
    const user = userEvent.setup();
    renderApp('/help/legal/general-terms-of-service');
    await screen.findByRole('heading', { level: 1, name: 'General Terms of Service' });

    await user.click(screen.getAllByRole('link', { name: 'Privacy Policy' })[0]);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Annex A — Privacy Policy' }),
    ).toBeInTheDocument();
  });

  it('reaches TOS & Policies from the help home', async () => {
    const user = userEvent.setup();
    renderApp('/help');
    await screen.findByText('How to book a delivery');

    await user.click(screen.getByRole('link', { name: /terms of service & policies/i }));
    expect(
      await screen.findByRole('heading', { level: 1, name: /terms of service & policies/i }),
    ).toBeInTheDocument();
  });
});

describe('public FAQ rich text', () => {
  it('renders an article body with headings, nested lists, and internal links', async () => {
    renderApp('/help/a/how-to-book-a-delivery');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'How to book a delivery' }),
    ).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: 'Before you start' })).toBeInTheDocument();

    // A nested list inside an ordered step keeps both levels.
    const nested = screen.getByText('Standard covers most destinations.');
    expect(nested.closest('ul')).toBeInTheDocument();
    expect(nested.closest('ol')).toBeInTheDocument();

    expect(screen.getByRole('link', { name: 'track the shipment' })).toHaveAttribute(
      'href',
      '/help/a/track-your-shipment',
    );
  });

  it('renders bold text as emphasis rather than literal markup', async () => {
    renderApp('/help/a/how-to-book-a-delivery');
    const bold = await screen.findByText('Book a delivery');
    expect(bold.tagName).toBe('STRONG');
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });
});
