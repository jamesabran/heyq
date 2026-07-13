// Support catalog seed (module state) — teams, concern taxonomy, and a demo
// transaction for "from transaction" prefill. Access via catalogService.
import type { Team, TicketCategory } from '../models/support';
import type { RelatedTransaction, SupportTier } from '../models/ticket';

const BRAND = 'ggx';

export const teams: Team[] = [
  { id: 'team-cs', name: 'Customer Support', brandId: BRAND },
  { id: 'team-claims', name: 'Claims', brandId: BRAND },
  { id: 'team-payments', name: 'Payments', brandId: BRAND },
  { id: 'team-tech', name: 'Technical', brandId: BRAND },
];

// Agent records (ids match the demo identities in IdentityContext so "My Queue"
// filters by the signed-in identity's id).
export interface AgentRecord {
  id: string;
  name: string;
  teamId?: string;
  tier?: SupportTier;
}

export const agents: AgentRecord[] = [
  { id: 'l1_agent', name: 'Alex Cruz', teamId: 'team-cs', tier: 'L1' },
  { id: 'l2_specialist', name: 'Bea Santos', teamId: 'team-claims', tier: 'L2' },
  { id: 'team_lead', name: 'Carlo Reyes', teamId: 'team-cs', tier: 'L2' },
  { id: 'admin', name: 'Ella Tan' },
];

export const ticketCategories: TicketCategory[] = [
  { id: 'cat-general', slug: 'general', name: 'General inquiry', defaultTeamId: 'team-cs', subcategories: [{ id: 'sub-gen-info', name: 'General information' }, { id: 'sub-gen-feedback', name: 'Feedback' }] },
  { id: 'cat-account', slug: 'account', name: 'Account', defaultTeamId: 'team-cs', subcategories: [{ id: 'sub-acc-access', name: 'Access & login' }, { id: 'sub-acc-profile', name: 'Profile & details' }] },
  { id: 'cat-disbursal', slug: 'disbursal', name: 'Disbursal', defaultTeamId: 'team-payments', requiresOrderRef: true, subcategories: [{ id: 'sub-dis-delay', name: 'Delayed disbursal' }, { id: 'sub-dis-amount', name: 'Incorrect amount' }] },
  { id: 'cat-claims', slug: 'claims', name: 'Claims', defaultTeamId: 'team-claims', requiresTracking: true, subcategories: [{ id: 'sub-cl-lost', name: 'Lost parcel' }, { id: 'sub-cl-damaged', name: 'Damaged parcel' }] },
  { id: 'cat-delivery', slug: 'delivery', name: 'Delivery', defaultTeamId: 'team-cs', requiresTracking: true, subcategories: [{ id: 'sub-del-late', name: 'Late delivery' }, { id: 'sub-del-status', name: 'Status inquiry' }] },
  { id: 'cat-pickup', slug: 'pickup', name: 'Pickup', defaultTeamId: 'team-cs', requiresTracking: true, subcategories: [{ id: 'sub-pu-missed', name: 'Missed pickup' }, { id: 'sub-pu-reschedule', name: 'Reschedule' }] },
  { id: 'cat-payment', slug: 'payment', name: 'Payment', defaultTeamId: 'team-payments', requiresOrderRef: true, subcategories: [{ id: 'sub-pay-failed', name: 'Failed payment' }, { id: 'sub-pay-refund', name: 'Refund' }] },
  { id: 'cat-cod', slug: 'cod', name: 'COD', defaultTeamId: 'team-payments', requiresTracking: true, requiresOrderRef: true, subcategories: [{ id: 'sub-cod-remit', name: 'Remittance' }, { id: 'sub-cod-amount', name: 'Amount collected' }] },
  { id: 'cat-returns', slug: 'returns', name: 'Returns', defaultTeamId: 'team-claims', requiresTracking: true, subcategories: [{ id: 'sub-ret-request', name: 'Return request' }, { id: 'sub-ret-status', name: 'Return status' }] },
  { id: 'cat-technical', slug: 'technical', name: 'Technical', defaultTeamId: 'team-tech', subcategories: [{ id: 'sub-tech-app', name: 'App issue' }, { id: 'sub-tech-web', name: 'Website issue' }] },
  { id: 'cat-other', slug: 'other', name: 'Other', defaultTeamId: 'team-cs', subcategories: [{ id: 'sub-other', name: 'Other' }] },
];

export const relatedTransactions: RelatedTransaction[] = [
  {
    id: 'TXN-1001',
    trackingNumber: 'GGX-8842019',
    orderId: 'ORD-55210',
    shipmentStatus: 'In transit',
    requesterName: 'Noah Villanueva',
    requesterEmail: 'noah.v@example.com',
    requesterMobile: '+63 917 555 0142',
  },
];
