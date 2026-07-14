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
    <div className="relative inline-flex min-w-0 items-center">
      <IconUserCog
        size={16}
        className="pointer-events-none absolute left-2.5 text-muted-foreground"
        aria-hidden="true"
      />
      {/* A native select sizes itself to its LONGEST option ("Bea Santos · L2
          Specialist (L2)" — 269px), which pushed the whole header past a 375px
          viewport and made the page scroll sideways. Cap it and let the label
          truncate; the full name is still in the open dropdown. */}
      <select
        aria-label="Simulated identity"
        value={identity.id}
        onChange={(e) => setIdentityId(e.target.value)}
        className="h-9 w-full max-w-[8.5rem] appearance-none truncate rounded-lg border border-border bg-background py-1.5 pl-8 pr-8 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:max-w-[16rem]"
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
