export interface ImportedLeadRow {
  external_ref?: string;
  shop_name: string;
  business_name?: string;
  contact_name?: string;
  phone_number: string;
  email?: string;
  town_city?: string;
  county_region?: string;
  postcode?: string;
  address_line_1?: string;
  address_line_2?: string;
  address_line_3?: string;
  priority_note?: string;
}

export interface ImportPreview {
  rows: ImportedLeadRow[];
  skipped: number;
}
