"use client";

import { useEffect, useState } from "react";
import type { LeadSource } from "@/features/lead-sources/types";
import {
  createLeadSource,
  fetchLeadSources,
  toggleLeadSource,
} from "@/features/lead-sources/queries";

export function LeadSourceManager() {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [newSourceName, setNewSourceName] = useState("");

  useEffect(() => {
    async function loadSources() {
      const rows = await fetchLeadSources();
      setSources(rows);
    }

    loadSources();
  }, []);

  async function handleAddSource() {
    const trimmed = newSourceName.trim();
    if (!trimmed) return;

    const created = await createLeadSource(trimmed);
    setSources((prev) => [...prev, created]);
    setNewSourceName("");
  }

  async function handleToggle(sourceId: string) {
    const updated = await toggleLeadSource(sourceId);
    setSources(updated);
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-semibold text-slate-900">Lead Sources</h2>
        <p className="mt-1 text-sm text-slate-600">
          Create and manage the source names used during imports and reporting.
        </p>
      </div>

      <div className="mt-6 flex gap-3">
        <input
          type="text"
          value={newSourceName}
          onChange={(e) => setNewSourceName(e.target.value)}
          placeholder="Add a new lead source..."
          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
        />
        <button
          type="button"
          onClick={handleAddSource}
          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
        >
          Add Source
        </button>
      </div>

      <div className="mt-6 space-y-3">
        {sources.map((source) => (
          <div
            key={source.id}
            className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
          >
            <div>
              <p className="font-medium text-slate-900">{source.name}</p>
              <p className="text-sm text-slate-500">
                {source.is_active ? "Active" : "Inactive"}
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleToggle(source.id)}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
            >
              {source.is_active ? "Disable" : "Enable"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

