// Support catalog contracts: teams and the concern taxonomy. Category carries a
// defaultTeamId (the simplest form of concern -> team routing) plus flags that
// drive the progressive submission form declaratively. Rule-based overrides and
// admin editing arrive in M6/M8.

export interface Team {
  id: string;
  name: string;
  brandId: string;
}

export interface TicketSubcategory {
  id: string;
  name: string;
}

export interface TicketCategory {
  id: string;
  slug: string;
  name: string;
  description?: string;
  defaultTeamId: string;
  subcategories: TicketSubcategory[];
  /** Show a tracking-number field for shipment-related concerns. */
  requiresTracking?: boolean;
  /** Show an order / reference field for payment-related concerns. */
  requiresOrderRef?: boolean;
}
