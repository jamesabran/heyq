import { IconMoon, IconSun } from '@tabler/icons-react';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from './ui/Button';

/** Persisted light/dark toggle. */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      {isDark ? <IconSun size={20} /> : <IconMoon size={20} />}
    </Button>
  );
}
