export interface ImportedInvoiceRow {
  invoice_ref: string;
  invoice_date: string | null;
  invoice_type: string | null;
  customer_name: string | null;
  description: string | null;
  total_amount: string | null;
  status: string | null;
  sent_status: string | null;
}
