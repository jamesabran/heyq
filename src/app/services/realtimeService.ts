/**
 * realtimeService — mints short-lived connection tokens for the realtime channel.
 *
 * A token is traded for a WebSocket subscription (see lib/realtimeClient.ts); it
 * is never a permanent credential and never travels in a URL. The agent app is
 * origin-trusted (same as every other internal route today), so it mints against
 * its agent identity.
 */
import { apiPost } from '../lib/apiClient';

export interface RealtimeToken {
  token: string;
  expiresInMs: number;
}

/** Mint an agent connection token for the signed-in agent identity. */
export async function getAgentRealtimeToken(agentId: string): Promise<RealtimeToken> {
  return apiPost<RealtimeToken>('/realtime/token', { agentId });
}

/**
 * Mint a customer connection token, scoped to one ticket. Provided for the
 * Business+ integration and the HeyQ requester portal; the server verifies the
 * requester may see the ticket before issuing a token.
 */
export async function getCustomerRealtimeToken(input: {
  externalUserId: string;
  externalOrgId: string;
  ticketId: string;
}): Promise<RealtimeToken> {
  return apiPost<RealtimeToken>('/customer/realtime/token', input);
}
