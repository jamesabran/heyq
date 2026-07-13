import type { ReactNode } from 'react';
import { Navigate, type RouteObject } from 'react-router';
import { AppLayout } from './layouts/AppLayout';
import { PublicLayout } from './layouts/PublicLayout';
import { PlaceholderPage } from './pages/PlaceholderPage';
import { Validation } from './pages/Validation';
import { HelpHome } from './pages/help/HelpHome';
import { HelpCategory } from './pages/help/HelpCategory';
import { HelpArticle } from './pages/help/HelpArticle';
import { HelpSearch } from './pages/help/HelpSearch';
import { ContactPage } from './pages/ContactPage';
import { RequesterPortal } from './pages/RequesterPortal';
import {
  AgentSearch,
  EscalatedQueue,
  MyQueue,
  SavedViews,
  SlaQueue,
  TeamTickets,
  UnassignedQueue,
} from './pages/app/queues';
import { TicketDetail } from './pages/app/TicketDetail';
import { RequireRole } from './components/RequireRole';
import { ADMIN_ROLES, AGENT_ROLES, AUDIT_ROLES, KB_ROLES, LEAD_ROLES, type Role } from './lib/roles';

const ph = (title: string, subtitle: string, milestone: string): ReactNode => (
  <PlaceholderPage title={title} subtitle={subtitle} milestone={milestone} />
);

const guard = (roles: Role[], node: ReactNode): ReactNode => (
  <RequireRole roles={roles}>{node}</RequireRole>
);

// Full route tree from docs/information-architecture.md. Milestone 2 delivers the
// navigable shell, routing, and role gating; screen content arrives later.
export const routes: RouteObject[] = [
  {
    path: '/',
    element: <PublicLayout />,
    children: [
      { index: true, element: <Navigate to="/app" replace /> },
      { path: 'help', element: <HelpHome /> },
      { path: 'help/search', element: <HelpSearch /> },
      { path: 'help/c/:category', element: <HelpCategory /> },
      { path: 'help/a/:slug', element: <HelpArticle /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 't/:token', element: <RequesterPortal /> },
      { path: 'validation', element: <Validation /> },
    ],
  },
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      { index: true, element: guard(AGENT_ROLES, <MyQueue />) },
      { path: 'team', element: guard(AGENT_ROLES, <TeamTickets />) },
      { path: 'unassigned', element: guard(AGENT_ROLES, <UnassignedQueue />) },
      { path: 'escalated', element: guard(AGENT_ROLES, <EscalatedQueue />) },
      { path: 'sla', element: guard(AGENT_ROLES, <SlaQueue />) },
      { path: 'tickets/:id', element: guard(AGENT_ROLES, <TicketDetail />) },
      { path: 'search', element: guard(AGENT_ROLES, <AgentSearch />) },
      { path: 'views', element: guard(AGENT_ROLES, <SavedViews />) },
      { path: 'supervisor', element: guard(LEAD_ROLES, ph('Team Dashboard', 'Workload and SLA compliance.', 'M9')) },
      { path: 'reports', element: guard(LEAD_ROLES, ph('Reports', 'Operational reports.', 'M9')) },
    ],
  },
  {
    path: '/admin',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/kb" replace /> },
      { path: 'kb', element: guard(KB_ROLES, ph('Manage Articles', 'Draft, revise, and publish KB articles.', 'M7')) },
      { path: 'agents', element: guard(ADMIN_ROLES, ph('Agents', 'Agent enrollment, roles, tiers, activation.', 'M8')) },
      { path: 'teams', element: guard(ADMIN_ROLES, ph('Teams & Queues', 'Teams and queues.', 'M8')) },
      { path: 'routing', element: guard(ADMIN_ROLES, ph('Routing Rules', 'Concern → team / tier routing.', 'M8')) },
      { path: 'sla', element: guard(ADMIN_ROLES, ph('SLA Policies', 'SLA policies and business hours.', 'M8')) },
      { path: 'categories', element: guard(ADMIN_ROLES, ph('Categories', 'Concern taxonomy management.', 'M8')) },
      { path: 'settings', element: guard(ADMIN_ROLES, ph('Settings', 'Brand, notification prefs, demo settings.', 'M8')) },
      { path: 'audit', element: guard(AUDIT_ROLES, ph('Audit Log', 'Simulated activity / audit log.', 'M8')) },
    ],
  },
  { path: '*', element: <Navigate to="/app" replace /> },
];
