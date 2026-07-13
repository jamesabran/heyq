// Simulated roles for UI gating (frontend-only; no real auth or enforcement).
// Mirrors the role set in docs/roles-and-ui-permissions.md.
export type Role =
  | 'guest'
  | 'customer'
  | 'l1_agent'
  | 'l2_specialist'
  | 'team_lead'
  | 'kb_editor'
  | 'admin';

export type SupportTier = 'L1' | 'L2';

export const ROLE_LABELS: Record<Role, string> = {
  guest: 'Guest',
  customer: 'GGX Customer',
  l1_agent: 'L1 Agent',
  l2_specialist: 'L2 Specialist',
  team_lead: 'Team Lead',
  kb_editor: 'KB Editor',
  admin: 'Admin',
};

// Role groupings used by both nav visibility and route guards, so the two never
// drift. Derived from the capability matrix (docs/roles-and-ui-permissions.md).
export const AGENT_ROLES: Role[] = ['l1_agent', 'l2_specialist', 'team_lead', 'admin'];
export const LEAD_ROLES: Role[] = ['team_lead', 'admin'];
export const KB_ROLES: Role[] = ['kb_editor', 'admin'];
export const ADMIN_ROLES: Role[] = ['admin'];
export const AUDIT_ROLES: Role[] = ['team_lead', 'admin'];

export function hasRole(role: Role, allowed: Role[]): boolean {
  return allowed.includes(role);
}
