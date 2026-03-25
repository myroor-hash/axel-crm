import type { ImportedInvoiceRow } from "@/features/invoices/types";

export async function importInvoices(args: {
  rows: ImportedInvoiceRow[];
}): Promise<{ imported: number; skipped: number }> {
  const importEndpoint: string = "/api/invoices/import";
  const response = await fetch(importEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  const payload = (await response.json().catch(() => null)) as
    | { imported?: number; skipped?: number; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to import invoices.");
  }

  return {
    imported: typeof payload?.imported === "number" ? payload.imported : 0,
    skipped: typeof payload?.skipped === "number" ? payload.skipped : 0,
  };
}

export async function clearImportedInvoices(): Promise<void> {
  const importEndpoint: string = "/api/invoices/import";
  const response = await fetch(importEndpoint, {
    method: "DELETE",
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to clear invoices.");
  }
}
