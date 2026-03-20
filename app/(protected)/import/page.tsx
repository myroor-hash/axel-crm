import { LeadImportWorkspace } from "@/components/import/lead-import-workspace";
import { InvoiceImportWorkspace } from "@/components/import/invoice-import-workspace";
import { ExportWorkspace } from "@/components/import/export-workspace";
import { PageHeader } from "@/components/layout/page-header";
import { LogoutButton } from "@/components/auth/logout-button";
import type { LeadSource } from "@/features/lead-sources/types";
import { createServerSupabaseClient } from "@/lib/db/server";
import type { LeadQueueItem } from "@/features/leads/types";

function normalizeBusinessName(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(ltd|limited|llp|co|company|inc|uk)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function namesLikelyMatch(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizeBusinessName(left);
  const normalizedRight = normalizeBusinessName(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const shorterLength = Math.min(normalizedLeft.length, normalizedRight.length);
  if (shorterLength < 6) {
    return false;
  }

  return (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
}

export default async function ImportPage() {
  const supabase = await createServerSupabaseClient();
  const { data: leadSources, error } = await supabase
    .from("lead_sources")
    .select("id, name, is_active")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load lead sources: ${error.message}`);
  }

  const normalizedLeadSources: LeadSource[] = (leadSources ?? []).map((source) => ({
    id: String(source.id),
    name: String(source.name),
    is_active: Boolean(source.is_active),
  }));

  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select(
      "id, external_ref, created_at, shop_name, contact_name, phone_number, email, postcode, town_city, status, last_outcome, last_contacted_at, next_follow_up_at, is_active"
    )
    .or("is_active.is.null,is_active.eq.true")
    .order("created_at", { ascending: false });

  if (leadsError) {
    throw new Error(`Failed to load leads for export: ${leadsError.message}`);
  }

  const { data: invoices, error: invoicesError } = await supabase
    .from("invoices")
    .select("customer_name, customer_ref");

  if (invoicesError && invoicesError.code !== "42P01") {
    throw new Error(`Failed to load invoice summary for export: ${invoicesError.message}`);
  }

  const invoiceRows = (invoices ?? []) as Array<{
    customer_name: string | null;
    customer_ref: string | null;
  }>;

  const exportRows: Array<
    LeadQueueItem & { email?: string | null; next_follow_up_at?: string | null; computed_has_contact_history?: boolean }
  > = (leads ?? []).map((lead) => {
    const customerNumber =
      typeof lead.external_ref === "string" ? lead.external_ref : null;
    const hasInvoiceHistory = invoiceRows.some((invoice) => {
      if (
        customerNumber &&
        typeof invoice.customer_ref === "string" &&
        invoice.customer_ref.trim().toLowerCase() === customerNumber.trim().toLowerCase()
      ) {
        return true;
      }

      return namesLikelyMatch(
        typeof lead.shop_name === "string" ? lead.shop_name : null,
        invoice.customer_name
      );
    });

    return {
      id: String(lead.id),
      customer_number: customerNumber,
      created_at: typeof lead.created_at === "string" ? lead.created_at : null,
      shop_name: String(lead.shop_name),
      town_city: typeof lead.town_city === "string" ? lead.town_city : null,
      contact_name: typeof lead.contact_name === "string" ? lead.contact_name : null,
      phone_number: typeof lead.phone_number === "string" ? lead.phone_number : null,
      postcode: typeof lead.postcode === "string" ? lead.postcode : null,
      has_invoice_history: hasInvoiceHistory,
      status: (typeof lead.status === "string" ? lead.status : "new") as LeadQueueItem["status"],
      last_outcome: typeof lead.last_outcome === "string" ? lead.last_outcome : null,
      last_contacted_at:
        typeof lead.last_contacted_at === "string" ? lead.last_contacted_at : null,
      is_locked: false,
      locked_by_name: null,
      email: typeof lead.email === "string" ? lead.email : null,
      next_follow_up_at:
        typeof lead.next_follow_up_at === "string" ? lead.next_follow_up_at : null,
      computed_has_contact_history: Boolean(
        lead.last_contacted_at || lead.last_outcome
      ),
    };
  });

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1200px] space-y-6">

        <PageHeader
          title="Import & Export"
          description="Upload spreadsheet data and export CRM queue lists for checking or offline use."
          actions={<LogoutButton />}
        />

        <LeadImportWorkspace leadSources={normalizedLeadSources} />
        <InvoiceImportWorkspace />
        <ExportWorkspace leads={exportRows} />

      </div>
    </main>
  );
}
