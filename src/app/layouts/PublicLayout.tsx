import { NavLink, Outlet } from 'react-router';
import { cn } from '../lib/utils';
import { Header } from '../components/layout/Header';
import { SkipLink } from '../components/layout/SkipLink';

const PUBLIC_LINKS = [
  { to: '/help', label: 'Help Center' },
  { to: '/contact', label: 'Contact' },
  { to: '/validation', label: 'Design System' },
];

/** Public (guest-facing) shell: header + a slim public nav, no workspace sidebar. */
export function PublicLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipLink />
      <Header />
      <div className="border-b border-border">
        <nav className="mx-auto flex max-w-5xl gap-1 px-4 py-2" aria-label="Public">
          {PUBLIC_LINKS.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                )
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
      <main id="main-content" className="mx-auto w-full max-w-5xl p-6">
        <Outlet />
      </main>
    </div>
  );
}
