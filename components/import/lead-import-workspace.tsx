"use client";

import { useMemo, useRef, useState } from "react";
import { parseLeadFile } from "@/features/import/parse-file";
import type { ImportedLeadRow } from "@/features/import/types";
import type { LeadSource } from "@/features/lead-sources/types";
import { createLeadSource } from "@/features/lead-sources/queries";
import { clearImportedCustomers, importCustomers } from "@/features/leads/queries";

export function LeadImportWorkspace({
  leadSources,
}: {
  leadSources: LeadSource[];
}) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [rows, setRows] = useState<ImportedLeadRow[]>([]);
  const [allRows, setAllRows] = useState<ImportedLeadRow[]>([]);
  const [selectedSource, setSelectedSource] = useState("");
  const [sources, setSources] = useState<LeadSource[]>(leadSources);
  const [newSourceName, setNewSourceName] = useState("");
  const [showNewSourceInput, setShowNewSourceInput] = useState(false);
  const [fileName, setFileName] = useState("");
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<{
    imported: number;
    skipped: number;
  } | null>(null);
  const [clearMessage, setClearMessage] = useState<string | null>(null);

  const activeSources = useMemo(
    () => sources.filter((s) => s.is_active),
    [sources]
  );

  async function handleFileUpload(file: File) {
    try {
      setUploadError(null);
      setImportResult(null);
      setClearMessage(null);

      const parsed = await parseLeadFile(file);
      setAllRows(parsed);
      setRows(parsed.slice(0, 20));
      setFileName(file.name);
    } catch (error) {
      setUploadError(
        error instanceof Error ? error.message : "Unable to parse file."
      );
    }
  }

  async function handleAddSource() {
    const trimmed = newSourceName.trim();
    if (!trimmed) return;

    const created = await createLeadSource(trimmed);
    const updated = [...sources, created];
    setSources(updated);
    setSelectedSource(created.id);
    setNewSourceName("");
    setShowNewSourceInput(false);
  }

  async function handleImport() {
    if (!selectedSource || allRows.length === 0) return;

    const result = await importCustomers({
      rows: allRows,
      leadSourceId: selectedSource,
    });

    setImportResult(result);
    setClearMessage(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function handleClearImported() {
    await clearImportedCustomers();
    setImportResult(null);
    setRows([]);
    setAllRows([]);
    setFileName("");
    setUploadError(null);
    setClearMessage("Imported test customers cleared.");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  const primaryButton =
    "rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50";

  const secondaryButton =
    "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100 active:scale-[0.98]";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-semibold text-slate-900">Import Customers</h2>
        <p className="mt-1 text-sm text-slate-700">
          Upload a CSV or Excel file, preview the first rows, and assign a source.
          This Pandle dataset will import as customers.
        </p>
      </div>

      <div className="mt-6 space-y-5">
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Spreadsheet
          </label>

          <div className="mt-2 flex items-center gap-3">
            <label className={`inline-flex cursor-pointer items-center justify-center ${primaryButton}`}>
              Upload Spreadsheet
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
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

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Lead Source
          </label>

          <div className="mt-2 flex gap-3">
            <select
              value={selectedSource}
              onChange={(e) => setSelectedSource(e.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900"
            >
              <option value="">Select source</option>

              {activeSources.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setShowNewSourceInput((prev) => !prev)}
              className={secondaryButton}
            >
              + New Source
            </button>
          </div>

          {showNewSourceInput ? (
            <div className="mt-3 flex gap-3">
              <input
                type="text"
                value={newSourceName}
                onChange={(e) => setNewSourceName(e.target.value)}
                placeholder="New source name..."
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900"
              />
              <button
                type="button"
                onClick={handleAddSource}
                className={primaryButton}
              >
                Save
              </button>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleClearImported}
            className={secondaryButton}
          >
            Clear Imported Test Customers
          </button>

          {clearMessage ? (
            <span className="text-sm font-medium text-slate-700">{clearMessage}</span>
          ) : null}
        </div>

        {rows.length > 0 ? (
          <div className="mt-4 overflow-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-800">
                <tr>
                  <th className="p-2 text-left">Ref</th>
                  <th className="p-2 text-left">Shop</th>
                  <th className="p-2 text-left">Contact</th>
                  <th className="p-2 text-left">Phone</th>
                  <th className="p-2 text-left">Town</th>
                </tr>
              </thead>

              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-t border-slate-200">
                    <td className="p-2 text-slate-900">{row.external_ref ?? "—"}</td>
                    <td className="p-2 text-slate-900">{row.shop_name}</td>
                    <td className="p-2 text-slate-800">{row.contact_name ?? "—"}</td>
                    <td className="p-2 text-slate-800">{row.phone_number}</td>
                    <td className="p-2 text-slate-800">{row.town_city ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
            <span>
              Ready to import {allRows.length} customer records.
              Duplicate refs or phone numbers will be skipped.
            </span>

            <button
              type="button"
              onClick={handleImport}
              disabled={!selectedSource}
              className={primaryButton}
            >
              Import Customers
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

