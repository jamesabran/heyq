import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { IdentityProvider } from '../../contexts/IdentityContext';
import { createArticle } from '../../services/kbService';
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
  it('separates FAQs from TOS & Policies and defaults to FAQs', async () => {
    renderApp('/admin/kb');
    expect(await screen.findByRole('heading', { name: 'Knowledge Base' })).toBeInTheDocument();

    const tabs = screen.getByRole('navigation', { name: /knowledge base sections/i });
    expect(within(tabs).getByRole('link', { name: 'FAQs' })).toBeInTheDocument();
    expect(within(tabs).getByRole('link', { name: 'TOS & Policies' })).toBeInTheDocument();

    // Landing on the FAQ section: FAQ content, no legal documents.
    expect(await screen.findByText('Upcoming feature notes')).toBeInTheDocument(); // draft
    expect(screen.getByText('Internal escalation runbook')).toBeInTheDocument(); // internal
    expect(screen.queryByText('General Terms of Service')).not.toBeInTheDocument();
  });

  it('groups FAQ articles under their category', async () => {
    renderApp('/admin/kb/faqs');
    expect(await screen.findByRole('heading', { name: 'Getting Started' })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: /FAQ articles in Getting Started/i });
    expect(within(table).getByText('How to book a delivery')).toBeInTheDocument();
    expect(within(table).queryByText('Reset your password')).not.toBeInTheDocument();
  });

  it('publishes a draft FAQ from the list', async () => {
    const user = userEvent.setup();
    renderApp('/admin/kb/faqs');
    const publishBtn = await screen.findByRole('button', { name: /^publish$/i });
    await user.click(publishBtn);
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: /^publish$/i })).not.toBeInTheDocument(),
    );
  });

  it('filters FAQs by search term and by status', async () => {
    const user = userEvent.setup();
    // Own the draft this test asserts on: seed state is module-level and shared,
    // so a sibling test publishing the seeded draft must not decide the outcome.
    await createArticle(
      {
        title: 'Draft fixture for filtering',
        kbCategoryId: 'cat-account',
        excerpt: 'Draft fixture.',
        body: '<p>Draft fixture body.</p>',
        visibility: 'public',
      },
      'kb_editor',
    );
    renderApp('/admin/kb/faqs');
    await screen.findByText('How to book a delivery');

    await user.type(screen.getByRole('searchbox', { name: /search faqs/i }), 'password');
    await waitFor(() => expect(screen.queryByText('How to book a delivery')).not.toBeInTheDocument());
    expect(screen.getByText('Reset your password')).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox', { name: /search faqs/i }));
    await user.selectOptions(screen.getByRole('combobox', { name: /filter by status/i }), 'draft');
    await waitFor(() => expect(screen.queryByText('Reset your password')).not.toBeInTheDocument());
    expect(screen.getByText('Draft fixture for filtering')).toBeInTheDocument();
  });

  it('reorders FAQ articles within a category', async () => {
    const user = userEvent.setup();
    renderApp('/admin/kb/faqs');

    const table = await screen.findByRole('table', { name: /FAQ articles in Getting Started/i });
    const titlesBefore = within(table).getAllByRole('link').map((l) => l.textContent);
    expect(titlesBefore[0]).toBe('How to book a delivery');

    // The first article can't move up; the second can move above it.
    expect(screen.getByRole('button', { name: /move How to book a delivery up/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /move Create your GGX account up/i }));

    await waitFor(() => {
      const rows = within(screen.getByRole('table', { name: /FAQ articles in Getting Started/i }))
        .getAllByRole('link')
        .map((l) => l.textContent);
      expect(rows[0]).toBe('Create your GGX account');
    });
  });

  it('blocks a guest from the KB admin area', async () => {
    renderApp('/admin/kb/faqs', 'guest');
    expect(await screen.findByText(/access restricted/i)).toBeInTheDocument();
  });
});

describe('TOS & Policies administration', () => {
  it('lists the General TOS and its annexes, drafts included', async () => {
    renderApp('/admin/kb/legal');
    expect(await screen.findByText('General Terms of Service')).toBeInTheDocument();
    expect(screen.getByText('Annex A — Privacy Policy')).toBeInTheDocument();
    expect(screen.getByText('Annex E — Data Processing Addendum')).toBeInTheDocument(); // draft
    // Legal section shows no FAQ content.
    expect(screen.queryByText('How to book a delivery')).not.toBeInTheDocument();
  });

  it('reorders legal documents, including the General TOS', async () => {
    const user = userEvent.setup();
    renderApp('/admin/kb/legal');

    const table = await screen.findByRole('table', { name: /terms of service and policy documents/i });
    expect(within(table).getAllByRole('link')[0]).toHaveTextContent('General Terms of Service');

    expect(screen.getByRole('button', { name: /move General Terms of Service up/i })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: /move General Terms of Service down/i }));

    await waitFor(() => {
      const links = within(screen.getByRole('table', { name: /terms of service and policy documents/i }))
        .getAllByRole('link');
      expect(links[0]).toHaveTextContent('Annex A — Privacy Policy');
    });
  });

  it('filters legal documents to drafts', async () => {
    const user = userEvent.setup();
    renderApp('/admin/kb/legal');
    await screen.findByText('General Terms of Service');

    await user.selectOptions(screen.getByRole('combobox', { name: /filter by status/i }), 'draft');
    await waitFor(() =>
      expect(screen.queryByText('General Terms of Service')).not.toBeInTheDocument(),
    );
    expect(screen.getByText('Annex E — Data Processing Addendum')).toBeInTheDocument();
  });

  it('blocks a guest from the legal admin area', async () => {
    renderApp('/admin/kb/legal', 'guest');
    expect(await screen.findByText(/access restricted/i)).toBeInTheDocument();
  });
});

describe('KB editors', () => {
  it('offers a rich-text toolbar for a FAQ answer', async () => {
    renderApp('/admin/kb/faqs/art-book');
    expect(await screen.findByRole('heading', { name: 'Edit FAQ' })).toBeInTheDocument();

    const toolbar = screen.getByRole('toolbar', { name: /formatting/i });
    for (const name of [
      /^bold$/i, /^italic$/i, /^underline$/i,
      /bulleted list/i, /numbered list/i,
      /increase indent/i, /decrease indent/i,
      /insert link/i, /^undo$/i, /^redo$/i, /clear formatting/i,
    ]) {
      expect(within(toolbar).getByRole('button', { name })).toBeInTheDocument();
    }
    expect(within(toolbar).getByRole('combobox', { name: /text style/i })).toBeInTheDocument();
  });

  it('offers internal KB links from both content types', async () => {
    const user = userEvent.setup();
    renderApp('/admin/kb/legal/legal-tos');
    await screen.findByRole('heading', { name: 'Edit legal document' });

    await user.click(screen.getByRole('button', { name: /insert link/i }));
    const picker = await screen.findByRole('combobox', { name: /link to knowledge base/i });
    expect(within(picker).getByRole('option', { name: 'Annex A — Privacy Policy' })).toBeInTheDocument();
    expect(within(picker).getByRole('option', { name: 'How to book a delivery' })).toBeInTheDocument();
  });

  it('previews a FAQ answer with its formatting intact', async () => {
    renderApp('/admin/kb/faqs/art-book?view=preview');
    await screen.findByRole('heading', { name: 'Edit FAQ' });

    // The preview renders the real body: headings, ordered list, nested list.
    expect(await screen.findByRole('heading', { name: 'Before you start' })).toBeInTheDocument();
    const nested = screen.getByText('Standard covers most destinations.');
    expect(nested.closest('ul')).toBeInTheDocument();
    expect(nested.closest('ol')).toBeInTheDocument(); // nested inside the ordered steps
    expect(screen.getByRole('link', { name: 'track the shipment' })).toHaveAttribute(
      'href',
      '/help/a/track-your-shipment',
    );
  });

  it('lists the linkable sections of a legal document', async () => {
    renderApp('/admin/kb/legal/legal-privacy');
    expect(await screen.findByRole('heading', { name: 'Linkable sections' })).toBeInTheDocument();
    // Anchors other annexes can target.
    expect(await screen.findByText('#data-we-collect')).toBeInTheDocument();
  });
});

describe('FAQ category administration', () => {
  it('lists categories with reorder controls and icon actions', async () => {
    renderApp('/admin/kb/faqs/categories');
    expect(await screen.findByRole('heading', { name: 'FAQ categories' })).toBeInTheDocument();

    expect(screen.getByRole('button', { name: /move Getting Started up/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /upload an icon for Getting Started/i })).toBeInTheDocument();
  });

  it('reorders categories independently of chronology', async () => {
    const user = userEvent.setup();
    renderApp('/admin/kb/faqs/categories');
    await screen.findByRole('heading', { name: 'FAQ categories' });

    await user.click(screen.getByRole('button', { name: /move Account & Profile up/i }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /move Account & Profile up/i })).toBeDisabled(),
    );
  });

  it('adds a category', async () => {
    const user = userEvent.setup();
    renderApp('/admin/kb/faqs/categories');
    await screen.findByRole('heading', { name: 'FAQ categories' });

    await user.type(screen.getByRole('textbox', { name: /^name$/i }), 'Insurance');
    await user.click(screen.getByRole('button', { name: /add category/i }));

    expect(await screen.findByRole('textbox', { name: /name for Insurance/i })).toBeInTheDocument();
  });

  it('surfaces the refusal to delete a category that still has articles', async () => {
    const user = userEvent.setup();
    renderApp('/admin/kb/faqs/categories');
    await screen.findByRole('heading', { name: 'FAQ categories' });

    await user.click(screen.getByRole('button', { name: /delete Technical & App/i }));
    expect(await screen.findByText(/articles first/i)).toBeInTheDocument();
  });
});
