/**
 * slaService — computes simulated SLA state for a ticket against the simulated
 * clock. Placeholder targets (first-response 4h, resolution 48h) — real policies
 * + business-hours accuracy arrive in M8 (docs/sla-simulation.md). Elapsed time
 * is wall-clock-simplified here (no business-hours calendar yet); the resolution
 * clock PAUSES while a ticket is Pending Requester.
 *
 * SLA state is independent of ticket status and escalation state.
 */
import type { SlaState, SlaSummary, SlaTargetSummary, Ticket } from '../models/ticket';
import { simulatedNowMs } from '../lib/clock';
import { slaConfig } from '../data/catalog';

const HOUR = 60 * 60 * 1000;
// Targets are read from the editable SLA config so admin changes flow through.
const firstResponseTargetMs = () => slaConfig.firstResponseHours * HOUR;
const resolutionTargetMs = () => slaConfig.resolutionHours * HOUR;
const AT_RISK_RATIO = 0.75;

function stateForElapsed(startIso: string, targetMs: number, doneAtIso?: string): SlaTargetSummary {
  const start = new Date(startIso).getTime();
  const dueAt = new Date(start + targetMs).toISOString();
  if (doneAtIso) return { state: 'met', dueAt };

  const elapsed = simulatedNowMs() - start;
  let state: SlaState;
  if (elapsed >= targetMs) state = 'breached';
  else if (elapsed >= targetMs * AT_RISK_RATIO) state = 'at_risk';
  else state = 'on_track';
  return { state, dueAt };
}

/** Compute the first-response + resolution SLA summary for a ticket. */
export function computeSlaSummary(ticket: Ticket): SlaSummary {
  const firstTarget = firstResponseTargetMs();
  const resolutionTarget = resolutionTargetMs();
  const firstResponse = stateForElapsed(ticket.createdAt, firstTarget, ticket.firstResponseAt);

  const resolvedish = ticket.status === 'resolved' || ticket.status === 'closed';
  let resolution: SlaTargetSummary;
  if (resolvedish) {
    resolution = stateForElapsed(ticket.createdAt, resolutionTarget, ticket.resolvedAt ?? ticket.updatedAt);
  } else if (ticket.status === 'pending_requester') {
    resolution = { state: 'paused', dueAt: new Date(new Date(ticket.createdAt).getTime() + resolutionTarget).toISOString() };
  } else {
    resolution = stateForElapsed(ticket.createdAt, resolutionTarget);
  }

  return { firstResponse, resolution };
}

/** True when either SLA target is at risk or breached (for the SLA queue). */
export function isSlaAtRiskOrBreached(ticket: Ticket): boolean {
  const { firstResponse, resolution } = computeSlaSummary(ticket);
  const flagged = (s: SlaState) => s === 'at_risk' || s === 'breached';
  return flagged(firstResponse.state) || flagged(resolution.state);
}
