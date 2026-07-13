import { NavLink } from 'react-router';
import { cn } from '../../lib/utils';
import { visibleSections } from '../../config/navigation';
import { useIdentity } from '../../contexts/IdentityContext';
import { ROLE_LABELS } from '../../lib/roles';

interface SidebarProps {
  open: boolean;
  onClose: () => void;
}

/** Responsive, role-aware sidebar: static on desktop, off-canvas drawer below `lg`. */
export function Sidebar({ open, onClose }: SidebarProps) {
  const { identity } = useIdentity();
  const sections = visibleSections(identity.role);

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" aria-hidden="true" onClick={onClose} />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:static lg:z-auto lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center px-4 lg:hidden">
          <span className="text-lg font-semibold">HeyQ</span>
        </div>

        <nav className="flex flex-col gap-5 p-3" aria-label="Primary">
          {sections.length === 0 && (
            <p className="px-3 py-2 text-sm text-muted-foreground">
              No workspace access for the {ROLE_LABELS[identity.role]} role.
            </p>
          )}
          {sections.map((section) => (
            <div key={section.id} className="flex flex-col gap-1">
              <p className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.label}
              </p>
              {section.items.map(({ to, label, icon: Icon, end }) => (
                <NavLink
                  key={to}
                  to={to}
                  end={end}
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
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
