import { NextResponse } from "next/server";
import { getCurrentCrmUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/db/admin";
import type { ImportedInvoiceRow } from "@/features/invoices/types";

function normalizeBusinessName(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(ltd|limited|llp|co|company|inc|uk)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export async function POST(request: Request) {
  const crmUser = await getCurrentCrmUser();

  if (!crmUser || !crmUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | { rows?: ImportedInvoiceRow[] }
    | null;
  const rows = Array.isArray(payload?.rows) ? payload.rows : [];

  if (rows.length === 0) {
    return NextResponse.json(
      { error: "No invoice rows were provided." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabaseClient();
  const { data: leads, error: leadsError } = await supabase
    .from("leads")
    .select("shop_name, external_ref")
    .or("is_active.is.null,is_active.eq.true");

  if (leadsError) {
    return NextResponse.json(
      { error: `Failed to load leads for invoice matching: ${leadsError.message}` },
      { status: 500 }
    );
  }

  const { data: existingRows, error: existingError } = await supabase
    .from("invoices")
    .select("invoice_ref");

  if (existingError) {
    if (existingError.code === "42P01") {
      return NextResponse.json(
        {
          error:
            "The invoices table does not exist in Supabase yet. Run database/invoices.sql first.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: `Failed to check existing invoices: ${existingError.message}` },
      { status: 500 }
    );
  }

  const seenInvoiceRefs = new Set(
    (existingRows ?? [])
      .map((row) =>
        typeof row.invoice_ref === "string"
          ? row.invoice_ref.trim().toLowerCase()
          : null
      )
      .filter((value): value is string => Boolean(value))
  );
  const leadRefByName = new Map<string, string>();

  for (const lead of leads ?? []) {
    const shopName =
      typeof lead.shop_name === "string" ? lead.shop_name : null;
    const externalRef =
      typeof lead.external_ref === "string" ? lead.external_ref : null;
    const normalizedName = normalizeBusinessName(shopName);

    if (normalizedName && externalRef) {
      leadRefByName.set(normalizedName, externalRef);
    }
  }

  let skipped = 0;
  const inserts: Array<Record<string, string | null>> = [];

  for (const row of rows) {
    const normalizedRef = row.invoice_ref.trim().toLowerCase();
    const normalizedCustomerName = normalizeBusinessName(row.customer_name);

    if (seenInvoiceRefs.has(normalizedRef)) {
      skipped += 1;
      continue;
    }

    inserts.push({
      invoice_ref: row.invoice_ref,
      invoice_date: row.invoice_date,
      invoice_type: row.invoice_type,
      customer_name: row.customer_name,
      customer_ref: leadRefByName.get(normalizedCustomerName) ?? null,
      description: row.description,
      total_amount: row.total_amount,
      status: row.status,
      sent_status: row.sent_status,
    });

    seenInvoiceRefs.add(normalizedRef);
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase
      .from("invoices")
      .upsert(inserts, {
        onConflict: "invoice_ref",
        ignoreDuplicates: true,
      });

    if (insertError) {
      return NextResponse.json(
        { error: `Failed to import invoices: ${insertError.message}` },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ imported: inserts.length, skipped });
}

export async function DELETE() {
  const crmUser = await getCurrentCrmUser();

  if (!crmUser || !crmUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase
    .from("invoices")
    .delete()
    .not("id", "is", null);

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json(
        {
          error:
            "The invoices table does not exist in Supabase yet. Run database/invoices.sql first.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: `Failed to clear invoices: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
