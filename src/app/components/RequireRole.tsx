import type { ReactNode } from 'react';
import { IconLock } from '@tabler/icons-react';
import { useIdentity } from '../contexts/IdentityContext';
import { ROLE_LABELS, type Role } from '../lib/roles';
import { Alert } from './ui/Alert';

/**
 * Simulated UI gate. If the current identity's role is not allowed, renders an
 * "access restricted" placeholder instead of the page — so every area stays
 * reachable by switching identity. This is UI gating only; real server-side
 * enforcement is a productionization concern.
 */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { identity } = useIdentity();
  if (roles.includes(identity.role)) return <>{children}</>;

  return (
    <div className="mx-auto max-w-xl py-8">
      <Alert variant="warning" icon={<IconLock size={18} />} title="Access restricted">
        <p>
          This area isn&apos;t available to the <strong>{ROLE_LABELS[identity.role]}</strong> role.
          Use the identity switcher in the header to view it as{' '}
          {roles.map((r) => ROLE_LABELS[r]).join(', ')}.
        </p>
      </Alert>
    </div>
  );
}
