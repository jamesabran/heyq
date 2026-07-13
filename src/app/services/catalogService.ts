/**
 * catalogService — read facade for support reference data (teams, concern
 * taxonomy, and demo transactions for prefill).
 *
 * Future API endpoints:
 *   GET /catalog/categories        → listCategories
 *   GET /catalog/teams             → listTeams
 *   GET /transactions/:id          → getTransactionById
 */
import { agents, relatedTransactions, teams, ticketCategories, type AgentRecord } from '../data/catalog';
import type { Team, TicketCategory } from '../models/support';
import type { RelatedTransaction } from '../models/ticket';
import { clone, simulateLatency } from '../lib/mock';

export async function listCategories(): Promise<TicketCategory[]> {
  await simulateLatency();
  return clone(ticketCategories);
}

export async function getCategoryById(id: string): Promise<TicketCategory | null> {
  await simulateLatency();
  return clone(ticketCategories.find((c) => c.id === id) ?? null);
}

export async function listTeams(): Promise<Team[]> {
  await simulateLatency();
  return clone(teams);
}

export async function getTeamById(id: string): Promise<Team | null> {
  await simulateLatency();
  return clone(teams.find((t) => t.id === id) ?? null);
}

export async function getTransactionById(id: string): Promise<RelatedTransaction | null> {
  await simulateLatency();
  return clone(relatedTransactions.find((t) => t.id === id) ?? null);
}

/** Agents, optionally scoped to a team (for reassignment pickers). */
export async function listAgents(teamId?: string): Promise<AgentRecord[]> {
  await simulateLatency();
  return clone(agents.filter((a) => !teamId || a.teamId === teamId));
}
