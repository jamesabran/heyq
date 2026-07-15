import { NavLink } from 'react-router';
import { cn } from '../../lib/utils';
import { PRODUCT_NAME } from '../../config/brand';
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
          // Mobile: an off-canvas drawer pinned to the full viewport (`inset-y-0`).
          // Desktop (`lg`): sticky under the 3.5rem header and sized to the viewport
          // (`h-[calc(100vh-3.5rem)]`), NOT to the main pane — so the rail always
          // reaches the bottom even when content is short, and its nav scrolls on
          // its own (`overflow-y-auto`) when it is taller than the viewport.
          'fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform lg:sticky lg:top-14 lg:z-auto lg:h-[calc(100vh-3.5rem)] lg:translate-x-0 lg:self-start',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center px-4 lg:hidden">
          <span className="text-lg font-semibold">{PRODUCT_NAME}</span>
        </div>

        <nav id="primary-navigation" className="flex flex-col gap-5 p-3" aria-label="Primary">
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
                      // Selected state uses the calmer teal secondary accent (M14),
                      // keeping strong brand red off ordinary navigation chrome.
                      isActive
                        ? 'bg-accent-brand/10 text-accent-brand'
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
