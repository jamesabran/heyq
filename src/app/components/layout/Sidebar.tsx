import { IconLayoutDashboard, IconPalette } from '@tabler/icons-react';
import { NavLink } from 'react-router';
import { cn } from '../../lib/utils';

// Placeholder navigation only. Real route groups and role-based gating arrive in
// Milestone 2 — this is structural scaffolding for the shell.
const NAV_ITEMS = [
  { to: '/', label: 'Overview', icon: IconLayoutDashboard },
  { to: '/validation', label: 'Design system', icon: IconPalette },
];

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

/** Responsive sidebar: static on desktop, off-canvas drawer below `lg`. */
export function Sidebar({ open, onClose }: SidebarProps) {
  return (
    <>
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          aria-hidden="true"
          onClick={onClose}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center px-4 lg:hidden">
          <span className="text-lg font-semibold">HeyQ</span>
        </div>
        <nav className="flex flex-col gap-1 p-3" aria-label="Primary">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              onClick={onClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )
              }
            >
              <Icon size={18} className="shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  );
}
