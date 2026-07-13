import { IconChevronDown, IconUserCog } from '@tabler/icons-react';
import { useIdentity } from '../contexts/IdentityContext';
import { ROLE_LABELS } from '../lib/roles';

/**
 * Simulated-identity switcher (demo/dev control). Lets reviewers view the app as
 * any role/tier/team. A native select keeps it fully accessible with minimal
 * code; real authentication is deferred to productionization.
 */
export function IdentitySwitcher() {
  const { identity, identities, setIdentityId } = useIdentity();
  return (
    <div className="relative inline-flex items-center">
      <IconUserCog
        size={16}
        className="pointer-events-none absolute left-2.5 text-muted-foreground"
        aria-hidden="true"
      />
      <select
        aria-label="Simulated identity"
        value={identity.id}
        onChange={(e) => setIdentityId(e.target.value)}
        className="h-9 appearance-none rounded-lg border border-border bg-background py-1.5 pl-8 pr-8 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {identities.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name} · {ROLE_LABELS[i.role]}
            {i.tier ? ` (${i.tier})` : ''}
          </option>
        ))}
      </select>
      <IconChevronDown
        size={14}
        className="pointer-events-none absolute right-2.5 text-muted-foreground"
        aria-hidden="true"
      />
    </div>
  );
}
