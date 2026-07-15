/**
 * In-memory state for the mock HeyQ server.
 *
 * HeyQ is the sole owner of ticket state, so this is THE ticket store — there is
 * no other. Neither browser app holds an authoritative copy.
 *
 * Multiple named stores exist so that test files can be isolated from one another
 * (and from the demo data) while still going through the real HTTP handler: a
 * client may send `X-Store-Id`, and anything without one shares the `default`
 * store that the running apps use. This is a test affordance, not a tenancy
 * model — the real HeyQ has one database.
 */
import { createSeedState, type SeedState } from './seed.ts';

export type Store = SeedState;

const stores = new Map<string, Store>();

export const DEFAULT_STORE = 'default';

export function getStore(id: string = DEFAULT_STORE): Store {
  let store = stores.get(id);
  if (!store) {
    store = createSeedState();
    stores.set(id, store);
  }
  return store;
}

/** Reset a store back to the seed. Used by tests and the demo reset endpoint. */
export function resetStore(id: string = DEFAULT_STORE): void {
  stores.set(id, createSeedState());
}

/** Simulated outage, per store — exercises the client's degraded paths. */
const downStores = new Set<string>();

export const isDown = (id: string = DEFAULT_STORE): boolean => downStores.has(id);

export function setDown(id: string, down: boolean): void {
  if (down) downStores.add(id);
  else downStores.delete(id);
}
