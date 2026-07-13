import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { RouterProvider, createMemoryRouter } from 'react-router';
import { ThemeProvider } from './contexts/ThemeContext';
import { RootLayout } from './layouts/RootLayout';
import { Overview } from './pages/Overview';
import { Validation } from './pages/Validation';

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/',
        element: <RootLayout />,
        children: [
          { index: true, element: <Overview /> },
          { path: 'validation', element: <Validation /> },
        ],
      },
    ],
    { initialEntries: [path] },
  );
  return render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>,
  );
}

describe('application shell', () => {
  it('renders the header brand mark and disabled brand control', () => {
    renderAt('/');
    const header = screen.getByRole('banner');
    expect(within(header).getByText('HeyQ')).toBeInTheDocument();

    const brandControl = screen.getByRole('button', { name: /ggx/i });
    expect(brandControl).toBeDisabled();
    expect(brandControl).toHaveAttribute('title', 'More brands coming soon');
  });

  it('renders the overview page at the index route', () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: /heyq foundation/i })).toBeInTheDocument();
  });
});

describe('design-system validation page', () => {
  it('shows distinct brand and destructive treatments', () => {
    renderAt('/validation');
    // Both a brand action and a destructive action are present and labelled.
    expect(screen.getByRole('button', { name: 'Brand action' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Destructive action' })).toBeInTheDocument();
    // Brand and destructive alerts coexist.
    expect(screen.getByText('Brand alert')).toBeInTheDocument();
    expect(screen.getByText('Destructive alert')).toBeInTheDocument();
  });
});
