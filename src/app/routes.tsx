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
import { HelpLegalIndex } from './pages/help/HelpLegalIndex';
import { HelpLegalDocument } from './pages/help/HelpLegalDocument';
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
import { NewTicket } from './pages/app/NewTicket';
import { QualityReviews } from './pages/app/QualityReviews';
import { ReviewWorkspace } from './pages/app/ReviewWorkspace';
import { AgentProfile } from './pages/app/AgentProfile';
import { Overview } from './pages/app/Overview';
import { Dashboard } from './pages/app/Dashboard';
import { NotificationsPage } from './pages/app/NotificationsPage';
import { KbFaqAdmin } from './pages/admin/KbFaqAdmin';
import { KbArticleEditor } from './pages/admin/KbArticleEditor';
import { KbCategoriesAdmin } from './pages/admin/KbCategoriesAdmin';
import { KbLegalAdmin } from './pages/admin/KbLegalAdmin';
import { KbLegalEditor } from './pages/admin/KbLegalEditor';
import { AgentsAdmin } from './pages/admin/AgentsAdmin';
import { TeamsAdmin } from './pages/admin/TeamsAdmin';
import { RoutingAdmin } from './pages/admin/RoutingAdmin';
import { SlaAdmin } from './pages/admin/SlaAdmin';
import { CategoriesAdmin } from './pages/admin/CategoriesAdmin';
import { AuditLog } from './pages/admin/AuditLog';
import { RequireRole } from './components/RequireRole';
import {
  ADMIN_ROLES,
  AGENT_ROLES,
  AUDIT_ROLES,
  KB_ROLES,
  LEAD_ROLES,
  OVERVIEW_ROLES,
  REVIEW_ROLES,
  type Role,
} from './lib/roles';

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
      { path: 'help/legal', element: <HelpLegalIndex /> },
      { path: 'help/legal/:slug', element: <HelpLegalDocument /> },
      { path: 'contact', element: <ContactPage /> },
      { path: 't/:token', element: <RequesterPortal /> },
      { path: 'validation', element: <Validation /> },
    ],
  },
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      // The Overview is the default authenticated landing for every signed-in
      // role (M19); My Queue keeps its own path in the nav.
      { index: true, element: guard(OVERVIEW_ROLES, <Overview />) },
      { path: 'mine', element: guard(AGENT_ROLES, <MyQueue />) },
      { path: 'team', element: guard(AGENT_ROLES, <TeamTickets />) },
      { path: 'unassigned', element: guard(AGENT_ROLES, <UnassignedQueue />) },
      { path: 'escalated', element: guard(AGENT_ROLES, <EscalatedQueue />) },
      { path: 'sla', element: guard(AGENT_ROLES, <SlaQueue />) },
      { path: 'tickets/new', element: guard(AGENT_ROLES, <NewTicket />) },
      { path: 'tickets/:id', element: guard(AGENT_ROLES, <TicketDetail />) },
      { path: 'search', element: guard(AGENT_ROLES, <AgentSearch />) },
      { path: 'views', element: guard(AGENT_ROLES, <SavedViews />) },
      { path: 'notifications', element: guard(AGENT_ROLES, <NotificationsPage />) },
      { path: 'supervisor', element: guard(LEAD_ROLES, <Dashboard scope="team" />) },
      { path: 'reviews', element: guard(REVIEW_ROLES, <QualityReviews />) },
      { path: 'reviews/:ticketId', element: guard(REVIEW_ROLES, <ReviewWorkspace />) },
      { path: 'agents/:agentId', element: guard(REVIEW_ROLES, <AgentProfile />) },
      { path: 'reports', element: guard(LEAD_ROLES, <Dashboard scope="all" />) },
    ],
  },
  {
    path: '/admin',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/admin/kb" replace /> },
      // The KB splits at the top by content type: operational FAQ content and
      // legal documents are managed independently (M20).
      {
        path: 'kb',
        children: [
          { index: true, element: <Navigate to="/admin/kb/faqs" replace /> },
          {
            path: 'faqs',
            children: [
              { index: true, element: guard(KB_ROLES, <KbFaqAdmin />) },
              { path: 'categories', element: guard(KB_ROLES, <KbCategoriesAdmin />) },
              { path: 'new', element: guard(KB_ROLES, <KbArticleEditor />) },
              { path: ':id', element: guard(KB_ROLES, <KbArticleEditor />) },
            ],
          },
          {
            path: 'legal',
            children: [
              { index: true, element: guard(KB_ROLES, <KbLegalAdmin />) },
              { path: 'new', element: guard(KB_ROLES, <KbLegalEditor />) },
              { path: ':id', element: guard(KB_ROLES, <KbLegalEditor />) },
            ],
          },
        ],
      },
      { path: 'agents', element: guard(ADMIN_ROLES, <AgentsAdmin />) },
      { path: 'teams', element: guard(ADMIN_ROLES, <TeamsAdmin />) },
      { path: 'routing', element: guard(ADMIN_ROLES, <RoutingAdmin />) },
      { path: 'sla', element: guard(ADMIN_ROLES, <SlaAdmin />) },
      { path: 'categories', element: guard(ADMIN_ROLES, <CategoriesAdmin />) },
      { path: 'settings', element: guard(ADMIN_ROLES, ph('Settings', 'Brand, notification prefs, demo settings.', 'M8')) },
      { path: 'audit', element: guard(AUDIT_ROLES, <AuditLog />) },
    ],
  },
  { path: '*', element: <Navigate to="/app" replace /> },
];
