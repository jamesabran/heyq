import {
  IconAdjustments,
  IconArchive,
  IconArrowUp,
  IconBell,
  IconBook,
  IconBookmark,
  IconCategory,
  IconChartBar,
  IconClock,
  IconHistory,
  IconId,
  IconInbox,
  IconLayoutDashboard,
  IconRoute,
  IconSearch,
  IconSettings,
  IconUsers,
  IconUsersGroup,
} from '@tabler/icons-react';
import { ADMIN_ROLES, AGENT_ROLES, AUDIT_ROLES, KB_ROLES, LEAD_ROLES, type Role } from '../lib/roles';

type TablerIcon = typeof IconInbox;

export interface NavItem {
  label: string;
  to: string;
  icon: TablerIcon;
  roles: Role[];
  /** Match the path exactly (for index-style routes like /app). */
  end?: boolean;
}

export interface NavSection {
  id: string;
  label: string;
  items: NavItem[];
}

// Single source of truth for authenticated navigation. Route guards reuse the
// same role groupings (lib/roles) so nav visibility and access never diverge.
export const APP_NAV: NavSection[] = [
  {
    id: 'workspace',
    label: 'Agent Workspace',
    items: [
      { label: 'My Queue', to: '/app', icon: IconInbox, roles: AGENT_ROLES, end: true },
      { label: 'Team Tickets', to: '/app/team', icon: IconUsers, roles: AGENT_ROLES },
      { label: 'Unassigned', to: '/app/unassigned', icon: IconArchive, roles: AGENT_ROLES },
      { label: 'Escalated', to: '/app/escalated', icon: IconArrowUp, roles: AGENT_ROLES },
      { label: 'SLA At-Risk', to: '/app/sla', icon: IconClock, roles: AGENT_ROLES },
      { label: 'Search', to: '/app/search', icon: IconSearch, roles: AGENT_ROLES },
      { label: 'Saved Views', to: '/app/views', icon: IconBookmark, roles: AGENT_ROLES },
      { label: 'Notifications', to: '/app/notifications', icon: IconBell, roles: AGENT_ROLES },
    ],
  },
  {
    id: 'supervisor',
    label: 'Supervisor',
    items: [
      { label: 'Team Dashboard', to: '/app/supervisor', icon: IconLayoutDashboard, roles: LEAD_ROLES },
      { label: 'Reports', to: '/app/reports', icon: IconChartBar, roles: LEAD_ROLES },
    ],
  },
  {
    id: 'kb',
    label: 'Knowledge Base',
    items: [{ label: 'Manage Articles', to: '/admin/kb', icon: IconBook, roles: KB_ROLES }],
  },
  {
    id: 'admin',
    label: 'Administration',
    items: [
      { label: 'Agents', to: '/admin/agents', icon: IconId, roles: ADMIN_ROLES },
      { label: 'Teams & Queues', to: '/admin/teams', icon: IconUsersGroup, roles: ADMIN_ROLES },
      { label: 'Routing Rules', to: '/admin/routing', icon: IconRoute, roles: ADMIN_ROLES },
      { label: 'SLA Policies', to: '/admin/sla', icon: IconAdjustments, roles: ADMIN_ROLES },
      { label: 'Categories', to: '/admin/categories', icon: IconCategory, roles: ADMIN_ROLES },
      { label: 'Settings', to: '/admin/settings', icon: IconSettings, roles: ADMIN_ROLES },
      { label: 'Audit Log', to: '/admin/audit', icon: IconHistory, roles: AUDIT_ROLES },
    ],
  },
];

/** Sections (and items) visible to a given role; empty sections are dropped. */
export function visibleSections(role: Role): NavSection[] {
  return APP_NAV.map((section) => ({
    ...section,
    items: section.items.filter((item) => item.roles.includes(role)),
  })).filter((section) => section.items.length > 0);
}
