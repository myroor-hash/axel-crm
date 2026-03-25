"use client";

import { useRef, useState } from "react";
import { parseInvoiceFile } from "@/features/invoices/parse-file";
import {
  clearImportedInvoices,
  importInvoices,
} from "@/features/invoices/queries";
import type { ImportedInvoiceRow } from "@/features/invoices/types";

export function InvoiceImportWorkspace() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rows, setRows] = useState<ImportedInvoiceRow[]>([]);
  const [allRows, setAllRows] = useState<ImportedInvoiceRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);
  const [clearMessage, setClearMessage] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const primaryButton =
    "rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50";
  const secondaryButton =
    "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100 active:scale-[0.98]";

  async function handleFileUpload(file: File) {
    try {
      setUploadError(null);
      setActionError(null);
      setImportResult(null);
      setClearMessage(null);

      const parsed = await parseInvoiceFile(file);
      setAllRows(parsed);
      setRows(parsed.slice(0, 20));
      setFileName(file.name);

      if (parsed.length === 0) {
        setUploadError("No invoice rows were found in that CSV file.");
      }
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Unable to parse invoice file."
      );
    }
  }

  async function handleImport() {
    if (allRows.length === 0) return;
    setIsImporting(true);
    setActionError(null);

    try {
      const result = await importInvoices({
        rows: allRows,
      });

      setImportResult(result);
      setClearMessage(null);

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to import invoices."
      );
    } finally {
      setIsImporting(false);
    }
  }

  async function handleClearImported() {
    setIsClearing(true);
    setActionError(null);

    try {
      await clearImportedInvoices();
      setImportResult(null);
      setRows([]);
      setAllRows([]);
      setFileName("");
      setUploadError(null);
      setClearMessage("Imported invoices cleared.");

      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to clear invoices."
      );
    } finally {
      setIsClearing(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-semibold text-slate-900">Import Invoices</h2>
        <p className="mt-1 text-sm text-slate-700">
          Upload the Pandle invoice CSV so invoice history appears inside each
          customer record.
        </p>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Invoice CSV
          </label>

          <div className="mt-2 flex items-center gap-3">
            <label className={`inline-flex cursor-pointer items-center justify-center ${primaryButton}`}>
              Upload Invoice CSV
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) handleFileUpload(file);
                }}
              />
            </label>

            <span className="text-sm font-medium text-slate-800">
              {fileName || "No file selected"}
            </span>
          </div>

          {uploadError ? (
            <p className="mt-2 text-sm font-medium text-red-700">{uploadError}</p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleClearImported}
            disabled={isClearing}
            className={secondaryButton}
          >
            {isClearing ? "Clearing..." : "Clear Imported Invoices"}
          </button>

          {clearMessage ? (
            <span className="text-sm font-medium text-slate-700">{clearMessage}</span>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <div className="overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-800">
                <tr>
                  <th className="p-2 text-left">Invoice</th>
                  <th className="p-2 text-left">Date</th>
                  <th className="p-2 text-left">Customer</th>
                  <th className="p-2 text-left">Total</th>
                  <th className="p-2 text-left">Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, index) => (
                  <tr key={`${row.invoice_ref}-${index}`} className="border-t border-slate-200">
                    <td className="p-2 text-slate-900">{row.invoice_ref}</td>
                    <td className="p-2 text-slate-800">{row.invoice_date ?? "—"}</td>
                    <td className="p-2 text-slate-800">{row.customer_name ?? "—"}</td>
                    <td className="p-2 text-slate-800">{row.total_amount ?? "—"}</td>
                    <td className="p-2 text-slate-800">{row.status ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {actionError ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {actionError}
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
            <span>
              Ready to import {allRows.length} invoice records. Existing invoice refs
              will be skipped.
            </span>

            <button
              type="button"
              onClick={handleImport}
              disabled={isImporting}
              className={primaryButton}
            >
              {isImporting ? "Importing..." : "Import Invoices"}
            </button>
          </div>
        ) : null}

        {importResult ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            Imported: <span className="font-medium">{importResult.imported}</span>
            {" · "}
            Skipped duplicates: <span className="font-medium">{importResult.skipped}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
