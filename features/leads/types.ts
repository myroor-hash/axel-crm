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
  customer_number?: string | null;
  created_at?: string | null;
  shop_name: string;
  town_city: string | null;
  contact_name?: string | null;
  phone_number?: string | null;
  postcode?: string | null;
  has_invoice_history?: boolean;
  status: LeadStatus;
  last_outcome?: string | null;
  last_contacted_at: string | null;
  last_activity_at?: string | null;
  last_activity_label?: string | null;
  next_follow_up_at?: string | null;
  recent_email_clicked_at?: string | null;
  is_locked: boolean;
  locked_by_name: string | null;
}

export interface LeadQueueView extends LeadQueueItem {
  computed_has_contact_history?: boolean;
  computed_follow_up_at?: string | null;
  computed_follow_up_due?: boolean;
  computed_status_badge?: string;
  queue_bucket?: "existing" | "follow_up" | "new_leads" | "other";
}

export interface LeadDetail {
  id: string;
  customer_number?: string | null;
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
  lead_source_name?: string | null;
  status: LeadStatus;
  customer_flag?: boolean;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  priority_note: string | null;
}

export interface InvoiceSummary {
  id: string;
  invoice_ref: string;
  invoice_date: string | null;
  customer_name: string | null;
  total_amount: string | null;
  status: string | null;
  sent_status: string | null;
  description: string | null;
}

export interface LeadEmailSummary {
  id: string;
  subject: string;
  recipient_email: string;
  sender_email: string;
  sent_by_name: string | null;
  attachment_name: string | null;
  sent_at: string;
  delivered_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  status: string;
}
