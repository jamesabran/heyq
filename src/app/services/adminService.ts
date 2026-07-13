/**
 * adminService — configuration writes for the admin surfaces (agents, teams,
 * routing, SLA, taxonomy). Mutates module-state catalog data so changes flow
 * through to downstream mock behavior (e.g. SLA badges, submission routing).
 *
 * Future API endpoints (illustrative):
 *   PATCH /agents/:id            → setAgentActive / setAgentTier
 *   POST  /teams                 → addTeam
 *   POST  /categories            → addCategory
 *   PATCH /categories/:id        → renameCategory / setCategoryTeam
 *   GET/PUT /sla-config          → getSlaConfig / updateSlaConfig
 */
import { agents, slaConfig, teams, ticketCategories, type AgentRecord } from '../data/catalog';
import type { Team, TicketCategory } from '../models/support';
import type { SupportTier } from '../models/ticket';
import { clone, makeId, simulateLatency } from '../lib/mock';

// ── Agents ───────────────────────────────────────────────────────────────────

export async function listAgentsAdmin(): Promise<AgentRecord[]> {
  await simulateLatency();
  return clone(agents);
}

export async function setAgentActive(id: string, active: boolean): Promise<AgentRecord> {
  await simulateLatency();
  const agent = agents.find((a) => a.id === id);
  if (!agent) throw new Error('Agent not found');
  agent.active = active;
  return clone(agent);
}

export async function setAgentTier(id: string, tier: SupportTier): Promise<AgentRecord> {
  await simulateLatency();
  const agent = agents.find((a) => a.id === id);
  if (!agent) throw new Error('Agent not found');
  agent.tier = tier;
  return clone(agent);
}

// ── Teams ────────────────────────────────────────────────────────────────────

export async function addTeam(name: string): Promise<Team> {
  await simulateLatency();
  const team: Team = { id: makeId('team'), name: name.trim(), brandId: 'ggx' };
  teams.push(team);
  return clone(team);
}

// ── Taxonomy & routing ───────────────────────────────────────────────────────

export async function addCategory(name: string, defaultTeamId: string): Promise<TicketCategory> {
  await simulateLatency();
  const category: TicketCategory = {
    id: makeId('cat'),
    slug: name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'category',
    name: name.trim(),
    defaultTeamId,
    subcategories: [],
  };
  ticketCategories.push(category);
  return clone(category);
}

/** Set a concern's routing target team (the routing rule for that category). */
export async function setCategoryTeam(id: string, teamId: string): Promise<TicketCategory> {
  await simulateLatency();
  const category = ticketCategories.find((c) => c.id === id);
  if (!category) throw new Error('Category not found');
  category.defaultTeamId = teamId;
  return clone(category);
}

export async function addSubcategory(categoryId: string, name: string): Promise<TicketCategory> {
  await simulateLatency();
  const category = ticketCategories.find((c) => c.id === categoryId);
  if (!category) throw new Error('Category not found');
  category.subcategories.push({ id: makeId('sub'), name: name.trim() });
  return clone(category);
}

// ── SLA config ───────────────────────────────────────────────────────────────

export type SlaConfig = typeof slaConfig;

export async function getSlaConfig(): Promise<SlaConfig> {
  await simulateLatency();
  return clone(slaConfig);
}

export async function updateSlaConfig(changes: Partial<SlaConfig>): Promise<SlaConfig> {
  await simulateLatency();
  if (changes.firstResponseHours !== undefined) slaConfig.firstResponseHours = changes.firstResponseHours;
  if (changes.resolutionHours !== undefined) slaConfig.resolutionHours = changes.resolutionHours;
  if (changes.businessHours !== undefined) slaConfig.businessHours = changes.businessHours;
  return clone(slaConfig);
}
