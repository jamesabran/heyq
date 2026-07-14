import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useQuery } from '../hooks/useQuery';
import { ErrorState } from './help/HelpStates';

describe('ErrorState', () => {
  it('renders a message and calls onRetry', async () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});

// A query that rejects should surface the error state — the pattern every data
// view now uses.
function Boom() {
  const q = useQuery(() => Promise.reject(new Error('load failed')), []);
  if (q.error) return <ErrorState onRetry={q.refetch} />;
  if (q.loading) return <p>loading…</p>;
  return <p>ok</p>;
}

describe('useQuery error wiring', () => {
  it('shows the error state when the loader rejects', async () => {
    render(<Boom />);
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
  });
});
