import Papa from "papaparse";
import type { ImportedInvoiceRow } from "@/features/invoices/types";

function asCleanString(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const cleaned = String(value).trim();
  if (!cleaned || cleaned.toLowerCase() === "nan") {
    return null;
  }

  return cleaned;
}

function normalizeDate(value: unknown): string | null {
  const cleaned = asCleanString(value);
  if (!cleaned) return null;

  const match = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) {
    return cleaned;
  }

  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

function normalizeRow(row: Record<string, unknown>): ImportedInvoiceRow {
  return {
    invoice_ref: asCleanString(row["Ref"]) ?? "",
    invoice_date: normalizeDate(row["Date"]),
    invoice_type: asCleanString(row["Type"]),
    customer_name: asCleanString(row["Customer"]),
    description: asCleanString(row["Description"]),
    total_amount: asCleanString(row["Total"]),
    status: asCleanString(row["Status"]),
    sent_status: asCleanString(row["Sent"]),
  };
}

export async function parseInvoiceFile(file: File): Promise<ImportedInvoiceRow[]> {
  const fileName = file.name.toLowerCase();

  if (!fileName.endsWith(".csv")) {
    throw new Error("Invoice imports currently support CSV files only.");
  }

  const text = await file.text();
  const parsed = Papa.parse(text, {
    header: true,
    skipEmptyLines: true,
  });

  const rows = (parsed.data ?? []) as Record<string, unknown>[];

  return rows
    .map(normalizeRow)
    .filter((row) => row.invoice_ref && row.customer_name);
}
