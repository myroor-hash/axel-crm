export type LeadStatus =
  | "new"
  | "attempted_contact"
  | "spoke_to_contact"
  | "follow_up_required"
  | "information_sent"
  | "sample_sent"
  | "customer"
  | "dead_lead";

export interface LeadQueueItem {
  id: string;
  shop_name: string;
  town_city: string | null;
  contact_name?: string | null;
  phone_number?: string | null;
  postcode?: string | null;
  status: LeadStatus;
  last_contacted_at: string | null;
  is_locked: boolean;
  locked_by_name: string | null;
}

export interface LeadDetail {
  id: string;
  external_ref?: string;
  shop_name: string;
  contact_first_name: string | null;
  contact_last_name: string | null;
  phone_number: string;
  email: string | null;
  town_city: string | null;
  county_region: string | null;
  postcode: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  address_line_3?: string | null;
  lead_source_id?: string | null;
  status: LeadStatus;
  customer_flag?: boolean;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  priority_note: string | null;
}

