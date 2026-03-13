import { createBrowserSupabaseClient } from "@/lib/db/client";
import type { ImportedInvoiceRow } from "@/features/invoices/types";

export async function importInvoices(args: {
  rows: ImportedInvoiceRow[];
}): Promise<{ imported: number; skipped: number }> {
  const supabase = createBrowserSupabaseClient();

  const { data: existingRows, error: existingError } = await supabase
    .from("invoices")
    .select("invoice_ref");

  if (existingError) {
    if (existingError.code === "42P01") {
      throw new Error(
        "The invoices table does not exist in Supabase yet. Run database/invoices.sql first."
      );
    }

    throw new Error(`Failed to check existing invoices: ${existingError.message}`);
  }

  const seenInvoiceRefs = new Set(
    (existingRows ?? [])
      .map((row) =>
        typeof row.invoice_ref === "string" ? row.invoice_ref.trim().toLowerCase() : null
      )
      .filter((value): value is string => Boolean(value))
  );

  let skipped = 0;
  const inserts: Array<Record<string, string | null>> = [];

  for (const row of args.rows) {
    const normalizedRef = row.invoice_ref.trim().toLowerCase();

    if (seenInvoiceRefs.has(normalizedRef)) {
      skipped += 1;
      continue;
    }

    inserts.push({
      invoice_ref: row.invoice_ref,
      invoice_date: row.invoice_date,
      invoice_type: row.invoice_type,
      customer_name: row.customer_name,
      customer_ref: null,
      description: row.description,
      total_amount: row.total_amount,
      status: row.status,
      sent_status: row.sent_status,
    });

    seenInvoiceRefs.add(normalizedRef);
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("invoices").insert(inserts);

    if (insertError) {
      throw new Error(`Failed to import invoices: ${insertError.message}`);
    }
  }

  return { imported: inserts.length, skipped };
}

export async function clearImportedInvoices(): Promise<void> {
  const supabase = createBrowserSupabaseClient();

  const { error } = await supabase.from("invoices").delete().not("id", "is", null);

  if (error) {
    if (error.code === "42P01") {
      throw new Error(
        "The invoices table does not exist in Supabase yet. Run database/invoices.sql first."
      );
    }

    throw new Error(`Failed to clear invoices: ${error.message}`);
  }
}
