import { IconMenu2 } from '@tabler/icons-react';
import { Link } from 'react-router';
import { PRODUCT_NAME } from '../../config/brand';
import { Button } from '../ui/Button';
import { ThemeToggle } from '../ThemeToggle';
import { IdentitySwitcher } from '../IdentitySwitcher';
import { NotificationBell } from '../NotificationBell';
import { BrandControl } from './BrandControl';

interface HeaderProps {
  /** When set, shows a menu button (authenticated shell with a sidebar). */
  onToggleSidebar?: () => void;
  /** Sidebar open state, for the toggle's aria-expanded. */
  sidebarOpen?: boolean;
}

/** Top application bar: menu toggle, brand mark, disabled brand control, identity switcher, theme toggle. */
export function Header({ onToggleSidebar, sidebarOpen }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/95 px-4 backdrop-blur">
      {onToggleSidebar && (
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation"
          aria-expanded={sidebarOpen ?? false}
          aria-controls="primary-navigation"
        >
          <IconMenu2 size={20} />
        </Button>
      )}

      <Link to="/" className="flex items-center gap-2">
        <span
          aria-hidden="true"
          className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm font-bold text-primary-foreground"
        >
          Q
        </span>
        {/* The wordmark is longer than the old one; below `sm` it folds away and the
            Q mark carries the brand, matching the BrandControl's own `sm` gate so the
            phone header never grows past the viewport. */}
        <span className="hidden whitespace-nowrap text-lg font-semibold text-foreground sm:inline">
          {PRODUCT_NAME}
        </span>
      </Link>

      <BrandControl className="ml-1 hidden sm:inline-flex" />

      {/* min-w-0 lets this group shrink instead of forcing the header wider than
          the viewport (the identity select is the widest thing in it). */}
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <IdentitySwitcher />
        {onToggleSidebar && <NotificationBell />}
        <ThemeToggle />
      </div>
    </header>
  );
}
