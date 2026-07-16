import { NavLink } from 'react-router';
import { IconGavel, IconHelpCircle } from '@tabler/icons-react';
import { cn } from '../../lib/utils';

/**
 * Top-level split of the admin Knowledge Base into its two content types.
 * Operational FAQ content and legal documents are managed separately, and this
 * is where that separation becomes visible.
 */
const SECTIONS = [
  { to: '/admin/kb/faqs', label: 'FAQs', icon: IconHelpCircle },
  { to: '/admin/kb/legal', label: 'TOS & Policies', icon: IconGavel },
];

export function KbSectionTabs() {
  return (
    <nav aria-label="Knowledge Base sections" className="flex gap-1 border-b border-border">
      {SECTIONS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              'flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive
                ? 'border-primary text-primary'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )
          }
        >
          <Icon size={16} aria-hidden="true" />
          {label}
        </NavLink>
      ))}
    </nav>
  );
}
