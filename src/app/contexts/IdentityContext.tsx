import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { Role, SupportTier } from '../lib/roles';

// A switchable simulated identity drives role-based UI. This is the demo/mock
// analogue of a real authenticated user — no real auth, session, or enforcement.
export interface Identity {
  id: string;
  name: string;
  role: Role;
  tier?: SupportTier;
  teamId?: string;
  teamName?: string;
  /** Seeded requester this identity submits as (customer role only, M19). */
  requesterId?: string;
  /**
   * Simulated GGX Business+ session (M22): the external user/org this identity
   * is authenticated as upstream. Stands in for the future SSO handoff.
   */
  businessPlus?: {
    externalUserId: string;
    externalOrgId: string;
    orgName: string;
  };
}

// Demo identities reviewers can switch between (one per role; agents carry a
// tier + team). Order here is the dropdown order.
export const DEMO_IDENTITIES: Record<string, Identity> = {
  guest: { id: 'guest', name: 'Guest Visitor', role: 'guest' },
  customer: {
    id: 'customer', name: 'Nadia Cruz', role: 'customer', requesterId: 'req-seed-3',
    businessPlus: { externalUserId: 'bp-user-nadia', externalOrgId: 'bp-org-acme', orgName: 'Acme Retail Corp' },
  },
  l1_agent: { id: 'l1_agent', name: 'Alex Cruz', role: 'l1_agent', tier: 'L1', teamId: 'team-cs', teamName: 'Customer Support' },
  l2_specialist: { id: 'l2_specialist', name: 'Bea Santos', role: 'l2_specialist', tier: 'L2', teamId: 'team-claims', teamName: 'Claims' },
  team_lead: { id: 'team_lead', name: 'Carlo Reyes', role: 'team_lead', tier: 'L2', teamId: 'team-cs', teamName: 'Customer Support' },
  kb_editor: { id: 'kb_editor', name: 'Dana Lim', role: 'kb_editor' },
  admin: { id: 'admin', name: 'Ella Tan', role: 'admin' },
};

const STORAGE_KEY = 'heyq-identity';
const DEFAULT_ID = 'admin';

function getInitialId(): string {
  if (typeof window === 'undefined') return DEFAULT_ID;
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return stored && stored in DEMO_IDENTITIES ? stored : DEFAULT_ID;
}

interface IdentityContextValue {
  identity: Identity;
  identities: Identity[];
  setIdentityId: (id: string) => void;
}

const IdentityContext = createContext<IdentityContextValue | undefined>(undefined);

export function IdentityProvider({ children }: { children: ReactNode }) {
  const [id, setId] = useState<string>(getInitialId);

  const setIdentityId = useCallback((next: string) => {
    if (!(next in DEMO_IDENTITIES)) return;
    window.localStorage.setItem(STORAGE_KEY, next);
    setId(next);
  }, []);

  const value = useMemo<IdentityContextValue>(
    () => ({
      identity: DEMO_IDENTITIES[id] ?? DEMO_IDENTITIES[DEFAULT_ID],
      identities: Object.values(DEMO_IDENTITIES),
      setIdentityId,
    }),
    [id, setIdentityId],
  );

  return <IdentityContext.Provider value={value}>{children}</IdentityContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useIdentity() {
  const ctx = useContext(IdentityContext);
  if (!ctx) throw new Error('useIdentity must be used within an IdentityProvider');
  return ctx;
}
