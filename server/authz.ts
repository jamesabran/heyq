/**
 * authz — server-side role checks for internal routes.
 *
 * HONEST SCOPE: HeyQ has no authentication (docs/integration-readiness.md, A1).
 * Every authorization input is caller-supplied — `agentId` in a body, `viewerId`
 * in a query — and this module is no different: it resolves the actor id the
 * caller sent. It is exactly as strong as the rest of the system, and no
 * stronger.
 *
 * What it DOES buy, and why it is worth having now: the restriction can no longer
 * be bypassed by editing the frontend, hiding a button, or calling the API
 * directly with the UI closed. The check lives in one server-side place, so when
 * real authentication lands it is swapped here rather than hunted for across
 * routes. Treat it as UI-strength enforcement, never as security.
 *
 * The demo's actor ids ARE role ids (`admin`, `team_lead`, `l1_agent`, …) — the
 * same assumption server/audit.ts already relies on to name actors.
 */
import { ROLE_LABELS, type Role } from '../src/app/lib/roles.ts';

/** The role an actor id denotes, or undefined when it denotes none. */
export function roleForActor(actorId: string | undefined): Role | undefined {
  if (!actorId) return undefined;
  return actorId in ROLE_LABELS ? (actorId as Role) : undefined;
}

/**
 * Refuse the request unless the actor holds one of `allowed`. The message is
 * matched to a 403 by `statusForError` in server/http.ts.
 */
export function requireRole(actorId: string | undefined, allowed: Role[], action: string): Role {
  const role = roleForActor(actorId);
  if (!role || !allowed.includes(role)) {
    throw new Error(`Not authorized to ${action}.`);
  }
  return role;
}
