// Mock GGX Business+ data (M22). This file stands in for what Business+ will
// later serve over its API: organizations, their users, and the orders each
// organization is authorized to see. Reached ONLY through the order-provider
// boundary (services/orderProvider.ts) — components never import this directly.
//
// External IDs (bp-org-*, bp-user-*, BP-ORD-*) are stable Business+ identifiers.
// They are stored on tickets as reference data and are never HeyQ primary keys.
import type { ShipmentStatus } from '../models/ticket';

export interface BusinessPlusOrg {
  externalOrgId: string;
  name: string;
}

export interface BusinessPlusUser {
  externalUserId: string;
  externalOrgId: string;
  name: string;
  email: string;
}

export interface BusinessPlusOrderRecord {
  externalOrderId: string;
  externalOrgId: string;
  trackingNumber: string;
  shipmentStatus: ShipmentStatus;
  bookingDate: string;
  senderSummary: string;
  recipientSummary: string;
  destination?: string;
}

export const businessPlusOrgs: BusinessPlusOrg[] = [
  { externalOrgId: 'bp-org-acme', name: 'Acme Retail Corp' },
  { externalOrgId: 'bp-org-zenith', name: 'Zenith Trading' },
];

export const businessPlusUsers: BusinessPlusUser[] = [
  { externalUserId: 'bp-user-nadia', externalOrgId: 'bp-org-acme', name: 'Nadia Cruz', email: 'nadia.cruz@example.com' },
  { externalUserId: 'bp-user-omar', externalOrgId: 'bp-org-zenith', name: 'Omar Villanueva', email: 'omar.v@example.com' },
];

// Orders are org-scoped: Acme users see BP-ORD-70xx, Zenith users BP-ORD-80xx.
// Tracking numbers follow the GGX format and don't collide with the M13 set.
export const businessPlusOrders: BusinessPlusOrderRecord[] = [
  {
    externalOrderId: 'BP-ORD-7001', externalOrgId: 'bp-org-acme',
    trackingNumber: 'Q7PL-2MRX-J90A', shipmentStatus: 'out_for_delivery',
    bookingDate: '2026-07-12T02:00:00Z',
    senderSummary: 'Acme Retail — Warehouse 3', recipientSummary: 'J. Ramos, Makati',
    destination: 'Makati City',
  },
  {
    externalOrderId: 'BP-ORD-7002', externalOrgId: 'bp-org-acme',
    trackingNumber: 'H3KD-8WTF-B45N', shipmentStatus: 'failed_delivery',
    bookingDate: '2026-07-10T06:30:00Z',
    senderSummary: 'Acme Retail — Warehouse 1', recipientSummary: 'C. Uy, Cebu City',
    destination: 'Cebu City',
  },
  {
    // tkt-seed-18's snapshot was captured while this was still in_transit; the
    // live record has since moved to delivered — demos snapshot vs refresh, and
    // that a live shipment change never touches the HeyQ ticket status.
    externalOrderId: 'BP-ORD-7003', externalOrgId: 'bp-org-acme',
    trackingNumber: 'Y6TN-4QSV-D28E', shipmentStatus: 'delivered',
    bookingDate: '2026-07-08T01:15:00Z',
    senderSummary: 'Acme Retail — Warehouse 3', recipientSummary: 'M. Santos, Davao',
    destination: 'Davao City',
  },
  {
    externalOrderId: 'BP-ORD-7004', externalOrgId: 'bp-org-acme',
    trackingNumber: 'R9GC-5ZLH-K73P', shipmentStatus: 'booked',
    bookingDate: '2026-07-14T03:45:00Z',
    senderSummary: 'Acme Retail — Warehouse 2', recipientSummary: 'A. Reyes, Pasig',
    destination: 'Pasig City',
  },
  // ── GGX Business+ handoff compatibility (M23) ─────────────────────────────
  // Business+ deep-links real OMS orders (`/contact?order=GGX-2026-90008`). Its
  // stable order id IS the GGX tracking number — that is the identifier every
  // Business+ route, lookup, and tracking surface keys on. These rows let the
  // handoff resolve against the mock provider; the real provider will serve them
  // from OMS and this block goes away. Additive on purpose: the BP-ORD-* set
  // above is untouched.
  {
    externalOrderId: 'GGX-2026-90008', externalOrgId: 'bp-org-acme',
    trackingNumber: 'GGX-2026-90008', shipmentStatus: 'failed_delivery',
    bookingDate: '2026-05-31T02:00:00Z',
    senderSummary: 'Acme Corporation', recipientSummary: 'Horizon Publishing Co., Pasig',
    destination: 'Pasig City',
  },
  {
    externalOrderId: 'GGX-2026-90004', externalOrgId: 'bp-org-acme',
    trackingNumber: 'GGX-2026-90004', shipmentStatus: 'in_transit',
    bookingDate: '2026-05-30T02:00:00Z',
    senderSummary: 'Acme Corporation', recipientSummary: 'Vertex Logistics Corp., Iloilo',
    destination: 'Iloilo City',
  },
  {
    externalOrderId: 'GGX-2026-90001', externalOrgId: 'bp-org-acme',
    trackingNumber: 'GGX-2026-90001', shipmentStatus: 'picked_up',
    bookingDate: '2026-05-29T02:00:00Z',
    senderSummary: 'Acme Corporation', recipientSummary: 'Bluewave E-Commerce, Davao',
    destination: 'Davao City',
  },
  {
    externalOrderId: 'GGX-2026-90009', externalOrgId: 'bp-org-acme',
    trackingNumber: 'GGX-2026-90009', shipmentStatus: 'in_transit',
    bookingDate: '2026-05-31T02:00:00Z',
    senderSummary: 'Acme Luzon', recipientSummary: 'Meridian Health Corp., Quezon City',
    destination: 'Quezon City',
  },
  {
    externalOrderId: 'GGX-2024-89240', externalOrgId: 'bp-org-acme',
    trackingNumber: 'GGX-2024-89240', shipmentStatus: 'delivered',
    bookingDate: '2026-05-18T02:00:00Z',
    senderSummary: 'Acme Corporation', recipientSummary: 'TechStart Solutions, Makati',
    destination: 'Makati City',
  },
  {
    externalOrderId: 'BP-ORD-8001', externalOrgId: 'bp-org-zenith',
    trackingNumber: 'V2WM-7JXB-F61S', shipmentStatus: 'in_transit',
    bookingDate: '2026-07-11T09:00:00Z',
    senderSummary: 'Zenith Trading — Main Hub', recipientSummary: 'R. Lim, Iloilo',
    destination: 'Iloilo City',
  },
  {
    externalOrderId: 'BP-ORD-8002', externalOrgId: 'bp-org-zenith',
    trackingNumber: 'G8FE-1CYD-N50U', shipmentStatus: 'returned',
    bookingDate: '2026-07-09T04:20:00Z',
    senderSummary: 'Zenith Trading — Main Hub', recipientSummary: 'T. Ong, Baguio',
    destination: 'Baguio City',
  },
];

/**
 * Simulated provider health. Tests (and demos) flip this to exercise the
 * degraded paths: order picking before submission and context refresh after.
 */
export const businessPlusProviderState = { available: true };
