import { useState } from 'react';
import { Outlet } from 'react-router';
import { Header } from '../components/layout/Header';
import { Sidebar } from '../components/layout/Sidebar';

/** Application shell: header + responsive sidebar + routed content area. */
export function RootLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Header onToggleSidebar={() => setSidebarOpen((v) => !v)} />
      <div className="flex">
        <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main className="min-w-0 flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
