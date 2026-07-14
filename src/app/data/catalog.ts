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
  active: boolean;
}

export const agents: AgentRecord[] = [
  { id: 'l1_agent', name: 'Alex Cruz', teamId: 'team-cs', tier: 'L1', active: true },
  { id: 'l2_specialist', name: 'Bea Santos', teamId: 'team-claims', tier: 'L2', active: true },
  { id: 'team_lead', name: 'Carlo Reyes', teamId: 'team-cs', tier: 'L2', active: true },
  { id: 'admin', name: 'Ella Tan', active: true },
];

// SLA configuration (module state, editable via the SLA admin screen). slaService
// reads these so edits flow through to SLA badges. Business hours is a label only
// (no real calendar in the mock).
export const slaConfig = {
  firstResponseHours: 4,
  resolutionHours: 48,
  businessHours: 'Mon–Fri, 9:00–18:00 (Asia/Manila)',
};

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

// GGX transaction context seed (M13). Realistic mock records covering the demo
// scenarios; sender/recipient are pre-masked (product rule #15). Shipment,
// payment, and remittance statuses vary independently. Reached only via
// transactionService. `restrictedTransactionIds` (below) drives the
// permission/ownership-mismatch state without polluting the contract.
export const relatedTransactions: RelatedTransaction[] = [
  {
    id: 'TXN-1001', trackingNumber: '1GGT-AYT1-TKK3', orderId: 'ORD-55210',
    shipmentStatus: 'in_transit', origin: 'Quezon City, NCR', destination: 'Cebu City, Cebu',
    senderMasked: 'No*** V***', recipientMasked: 'Ma*** S***',
    requesterName: 'Noah Villanueva', requesterEmail: 'noah.v@example.com', requesterMobile: '+63 917 555 0142',
    bookingDate: '2026-07-12T01:00:00Z', pickupDate: '2026-07-12T04:00:00Z', latestMovementAt: '2026-07-13T22:00:00Z',
    currency: 'PHP', shippingFee: 120, charges: [{ label: 'Insurance', amount: 30 }],
    paymentMethod: 'Prepaid (GCash)', paymentStatus: 'paid', remittanceStatus: 'not_applicable',
    dataSource: 'GGX Xpress (mock)', lastUpdatedAt: '2026-07-14T06:00:00Z',
  },
  // Scenario: shipment with no recent movement (tkt-seed-1).
  {
    id: 'TXN-2001', trackingNumber: 'T5X0-0BMM-KPP6', orderId: 'ORD-55001',
    shipmentStatus: 'in_transit', origin: 'Makati City, NCR', destination: 'Davao City, Davao del Sur',
    senderMasked: 'Li** A*****', recipientMasked: 'Re*** D**',
    bookingDate: '2026-07-06T02:00:00Z', pickupDate: '2026-07-06T05:00:00Z', latestMovementAt: '2026-07-08T09:00:00Z',
    currency: 'PHP', shippingFee: 210, paymentMethod: 'Prepaid (Card)', paymentStatus: 'paid', remittanceStatus: 'not_applicable',
    dataSource: 'GGX Xpress (mock)', lastUpdatedAt: '2026-07-08T09:00:00Z',
  },
  // Scenario: COD collected but not yet remitted (tkt-seed-2).
  {
    id: 'TXN-2002', trackingNumber: 'D4XV-A7ND-SQCZ', orderId: 'ORD-54120',
    shipmentStatus: 'delivered', origin: 'Pasig City, NCR', destination: 'Iloilo City, Iloilo',
    senderMasked: 'Ma*** R****', recipientMasked: 'An** G*****',
    bookingDate: '2026-06-30T01:00:00Z', pickupDate: '2026-06-30T04:00:00Z', deliveryDate: '2026-07-02T07:00:00Z', latestMovementAt: '2026-07-02T07:00:00Z',
    currency: 'PHP', shippingFee: 150, paymentMethod: 'Cash on Delivery', paymentStatus: 'paid',
    codAmount: 1450, remittanceStatus: 'pending',
    dataSource: 'GGX Remittance (mock)', lastUpdatedAt: '2026-07-06T03:00:00Z',
  },
  // Scenario: missed / failed pickup (tkt-seed-3).
  {
    id: 'TXN-2003', trackingNumber: 'ZTQZ-F924-ZZ0P', orderId: 'ORD-55330',
    shipmentStatus: 'booked', origin: 'Taguig City, NCR', destination: 'Baguio City, Benguet',
    senderMasked: 'Na*** C***', recipientMasked: 'Pa*** L**',
    bookingDate: '2026-07-14T00:00:00Z', currency: 'PHP', shippingFee: 180, paymentMethod: 'Prepaid (GCash)', paymentStatus: 'paid', remittanceStatus: 'not_applicable',
    exceptions: [{ type: 'failed_attempt', reason: 'Pickup rider did not arrive at scheduled window', at: '2026-07-14T06:30:00Z' }],
    dataSource: 'GGX Xpress (mock)', lastUpdatedAt: '2026-07-14T06:30:00Z',
  },
  // Scenario: damaged parcel (tkt-seed-6).
  {
    id: 'TXN-2004', trackingNumber: '8HMR-2QW4-LJ7N', orderId: 'ORD-53980',
    shipmentStatus: 'delivered', origin: 'Mandaluyong City, NCR', destination: 'Bacolod City, Negros Occidental',
    senderMasked: 'Qu***** L**', recipientMasked: 'Vi**** S**',
    bookingDate: '2026-07-10T01:00:00Z', pickupDate: '2026-07-10T04:00:00Z', deliveryDate: '2026-07-13T05:00:00Z', latestMovementAt: '2026-07-13T05:00:00Z',
    currency: 'PHP', shippingFee: 165, charges: [{ label: 'Insurance', amount: 40 }], paymentMethod: 'Prepaid (Card)', paymentStatus: 'paid', remittanceStatus: 'not_applicable',
    exceptions: [{ type: 'exception', reason: 'Recipient reported parcel damaged on delivery', at: '2026-07-13T05:30:00Z' }],
    dataSource: 'GGX Xpress (mock)', lastUpdatedAt: '2026-07-13T06:00:00Z',
  },
  // Scenario: missing high-value parcel (tkt-seed-7) — RESTRICTED to demo the
  // permission / ownership-mismatch state for agents outside the owning team.
  {
    id: 'TXN-2005', trackingNumber: 'KP3D-9VXA-R60T', orderId: 'ORD-53110',
    shipmentStatus: 'on_hold', origin: 'Parañaque City, NCR', destination: 'Cagayan de Oro, Misamis Oriental',
    senderMasked: 'Na*** C***', recipientMasked: 'He*** V**',
    bookingDate: '2026-07-04T01:00:00Z', pickupDate: '2026-07-04T04:00:00Z', latestMovementAt: '2026-07-07T02:00:00Z',
    currency: 'PHP', shippingFee: 320, charges: [{ label: 'Insurance (high value)', amount: 250 }], paymentMethod: 'Prepaid (Card)', paymentStatus: 'paid', remittanceStatus: 'not_applicable',
    exceptions: [{ type: 'exception', reason: 'No hub scan recorded for 7 days — trace opened', at: '2026-07-11T02:00:00Z' }],
    dataSource: 'GGX Xpress (mock)', lastUpdatedAt: '2026-07-13T01:00:00Z',
  },
  // Scenario: parcel marked delivered but not received (tkt-seed-9).
  {
    id: 'TXN-2006', trackingNumber: 'WQ7L-3NBE-C21M', orderId: 'ORD-56010',
    shipmentStatus: 'delivered', origin: 'Manila, NCR', destination: 'Lipa City, Batangas',
    senderMasked: 'Ol**** T**', recipientMasked: 'Gr*** F*****',
    bookingDate: '2026-07-11T01:00:00Z', pickupDate: '2026-07-11T03:00:00Z', deliveryDate: '2026-07-13T08:00:00Z', latestMovementAt: '2026-07-13T08:00:00Z',
    currency: 'PHP', shippingFee: 110, paymentMethod: 'Prepaid (GCash)', paymentStatus: 'paid', remittanceStatus: 'not_applicable',
    exceptions: [{ type: 'exception', reason: 'Marked delivered; recipient disputes receipt (POD signature illegible)', at: '2026-07-13T08:10:00Z' }],
    dataSource: 'GGX Xpress (mock)', lastUpdatedAt: '2026-07-14T05:00:00Z',
  },
  // Scenario: incorrect COD amount (tkt-seed-10).
  {
    id: 'TXN-2007', trackingNumber: 'F0YK-D8ST-U49R', orderId: 'ORD-56120',
    shipmentStatus: 'delivered', origin: 'Caloocan City, NCR', destination: 'Naga City, Camarines Sur',
    senderMasked: 'Sa** M*****', recipientMasked: 'Do*** R***',
    bookingDate: '2026-07-09T01:00:00Z', pickupDate: '2026-07-09T03:00:00Z', deliveryDate: '2026-07-11T06:00:00Z', latestMovementAt: '2026-07-11T06:00:00Z',
    currency: 'PHP', shippingFee: 140, paymentMethod: 'Cash on Delivery', paymentStatus: 'paid',
    codAmount: 2000, remittanceStatus: 'pending',
    exceptions: [{ type: 'exception', reason: 'Rider collected ₱2,000; order value recorded as ₱1,750', at: '2026-07-11T06:15:00Z' }],
    dataSource: 'GGX Remittance (mock)', lastUpdatedAt: '2026-07-12T02:00:00Z',
  },
  // Scenario: failed delivery with an unclear reason (tkt-seed-11).
  {
    id: 'TXN-2008', trackingNumber: '6BZC-M1PW-HX52', orderId: 'ORD-56230',
    shipmentStatus: 'failed_delivery', origin: 'Las Piñas City, NCR', destination: 'Tacloban City, Leyte',
    senderMasked: 'Ge**** P*****', recipientMasked: 'Ka*** U*****',
    bookingDate: '2026-07-10T01:00:00Z', pickupDate: '2026-07-10T03:00:00Z', latestMovementAt: '2026-07-13T11:00:00Z',
    currency: 'PHP', shippingFee: 195, paymentMethod: 'Prepaid (Card)', paymentStatus: 'paid', remittanceStatus: 'not_applicable',
    exceptions: [{ type: 'failed_attempt', reason: 'Delivery failed — reason not specified by rider', at: '2026-07-13T11:00:00Z' }],
    dataSource: 'GGX Xpress (mock)', lastUpdatedAt: '2026-07-13T12:00:00Z',
  },
  // Scenario: returned parcel / disputed return fee (tkt-seed-12).
  {
    id: 'TXN-2009', trackingNumber: 'N2VJ-K7RD-A83Q', orderId: 'ORD-56350',
    shipmentStatus: 'returned', origin: 'San Juan City, NCR', destination: 'Puerto Princesa, Palawan',
    senderMasked: 'Ir** D*****', recipientMasked: 'Be** A****',
    bookingDate: '2026-07-05T01:00:00Z', pickupDate: '2026-07-05T03:00:00Z', deliveryDate: '2026-07-09T05:00:00Z', latestMovementAt: '2026-07-12T04:00:00Z',
    currency: 'PHP', shippingFee: 230, charges: [{ label: 'Return fee', amount: 90 }], paymentMethod: 'Prepaid (Card)', paymentStatus: 'paid', remittanceStatus: 'not_applicable',
    exceptions: [{ type: 'return', reason: 'Recipient unavailable after 3 attempts; return fee disputed', at: '2026-07-12T04:00:00Z' }],
    dataSource: 'GGX Xpress (mock)', lastUpdatedAt: '2026-07-12T05:00:00Z',
  },
  // Scenario: payment completed but booking not created (tkt-seed-13).
  {
    id: 'TXN-2010', trackingNumber: '3SLE-Y5GC-P70W', orderId: 'ORD-56470',
    shipmentStatus: 'on_hold', origin: 'Pasay City, NCR', destination: '—',
    senderMasked: 'Fe*** B*****', recipientMasked: '—',
    currency: 'PHP', shippingFee: 130, paymentMethod: 'Prepaid (GCash)', paymentStatus: 'paid', remittanceStatus: 'not_applicable',
    exceptions: [{ type: 'exception', reason: 'Payment captured but booking was not created — no pickup scheduled', at: '2026-07-14T01:00:00Z' }],
    dataSource: 'GGX Payments (mock)', lastUpdatedAt: '2026-07-14T01:00:00Z',
  },
  // Scenario: incorrect recipient address (tkt-seed-14).
  {
    id: 'TXN-2011', trackingNumber: 'XG9B-T4HM-V16D', orderId: 'ORD-56590',
    shipmentStatus: 'in_transit', origin: 'Marikina City, NCR', destination: 'Antipolo City, Rizal (address flagged)',
    senderMasked: 'Ro*** M****', recipientMasked: 'Ni** F******',
    bookingDate: '2026-07-13T01:00:00Z', pickupDate: '2026-07-13T03:00:00Z', latestMovementAt: '2026-07-14T02:00:00Z',
    currency: 'PHP', shippingFee: 105, paymentMethod: 'Prepaid (Card)', paymentStatus: 'paid', remittanceStatus: 'not_applicable',
    exceptions: [{ type: 'exception', reason: 'Recipient requested address correction before next attempt', at: '2026-07-14T02:00:00Z' }],
    dataSource: 'GGX Xpress (mock)', lastUpdatedAt: '2026-07-14T03:00:00Z',
  },
];

// Mock-only: transactions restricted to a single owning team (drives the
// permission/ownership-mismatch state). Admin (no team scope) and the owning
// team can view; other teams get the mismatch state. Kept OUT of the
// RelatedTransaction contract so the shape a real API returns stays clean
// (product rule #14).
export const transactionAccess: Record<string, { allowedTeamId: string }> = {
  'TXN-2005': { allowedTeamId: 'team-claims' },
};
