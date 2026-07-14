import { useEffect, useState } from 'react';
import { Outlet } from 'react-router';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';
import { SkipLink } from '../components/layout/SkipLink';

/** Authenticated application shell for /app and /admin: header + role-aware sidebar + content. */
export function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close the mobile sidebar on Escape.
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSidebarOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sidebarOpen]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SkipLink />
      <Header onToggleSidebar={() => setSidebarOpen((v) => !v)} sidebarOpen={sidebarOpen} />
      <div className="flex">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main id="main-content" className="min-w-0 flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
