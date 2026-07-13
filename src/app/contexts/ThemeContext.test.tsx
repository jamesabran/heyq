import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from './ThemeContext';
import { ThemeToggle } from '../components/ThemeToggle';

function renderToggle() {
  return render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
}

describe('theme system', () => {
  it('defaults to light and applies no dark class', () => {
    renderToggle();
    expect(document.documentElement).not.toHaveClass('dark');
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
  });

  it('toggles dark mode and persists the choice', async () => {
    const user = userEvent.setup();
    renderToggle();

    await user.click(screen.getByRole('button', { name: /switch to dark mode/i }));

    expect(document.documentElement).toHaveClass('dark');
    expect(window.localStorage.getItem('heyq-theme')).toBe('dark');
    expect(screen.getByRole('button', { name: /switch to light mode/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /switch to light mode/i }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(window.localStorage.getItem('heyq-theme')).toBe('light');
  });

  it('restores a persisted dark preference on load', () => {
    window.localStorage.setItem('heyq-theme', 'dark');
    renderToggle();
    expect(document.documentElement).toHaveClass('dark');
  });
});
