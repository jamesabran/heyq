// Simulated clock for SLA countdowns and time-relative state. Anchored to a fixed
// "now" so seed data yields deterministic, sensible SLA states regardless of the
// real wall clock (docs/sla-simulation.md). A future milestone can make this
// advanceable for demos; for now it is a constant.
const SIMULATED_NOW = '2026-07-14T09:00:00Z';

export function getSimulatedNow(): Date {
  return new Date(SIMULATED_NOW);
}

export function simulatedNowMs(): number {
  return getSimulatedNow().getTime();
}
