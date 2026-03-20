"use client";

import { useMemo } from "react";
import type { LeadQueueItem } from "@/features/leads/types";

type QueueTab = "existing" | "chasing" | "new_leads";

function escapeCsvCell(value: string | null | undefined) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function preserveCsvText(value: string | null | undefined) {
  const text = String(value ?? "");
  if (!text) return "";
  return `\t${text}`;
}

function matchesQueueTab(
  lead: LeadQueueItem & {
    computed_has_contact_history?: boolean;
  },
  tab: QueueTab
) {
  if (lead.has_invoice_history) {
    return tab === "existing";
  }

  if (lead.computed_has_contact_history) {
    return tab === "chasing";
  }

  return tab === "new_leads";
}

export function ExportWorkspace({
  leads,
}: {
  leads: Array<
    LeadQueueItem & {
      computed_has_contact_history?: boolean;
    }
  >;
}) {
  const exportCounts = useMemo(
    () => ({
      existing: leads.filter((lead) => matchesQueueTab(lead, "existing")).length,
      chasing: leads.filter((lead) => matchesQueueTab(lead, "chasing")).length,
      newLeads: leads.filter((lead) => matchesQueueTab(lead, "new_leads")).length,
    }),
    [leads]
  );

  function downloadQueueCsv(tab: QueueTab) {
    const rows = leads.filter((lead) => matchesQueueTab(lead, tab));
    const header = [
      "Shop Name",
      "Contact Name",
      "Phone",
      "Email",
      "Town / City",
      "Postcode",
      "Customer Number",
      "Status",
      "Last Contacted",
      "Next Follow Up",
    ];

    const csvRows = rows.map((lead) =>
      [
        escapeCsvCell(lead.shop_name),
        escapeCsvCell(lead.contact_name ?? ""),
        preserveCsvText(lead.phone_number ?? ""),
        escapeCsvCell((lead as { email?: string | null }).email ?? ""),
        escapeCsvCell(lead.town_city ?? ""),
        escapeCsvCell(lead.postcode ?? ""),
        escapeCsvCell(lead.customer_number ?? ""),
        escapeCsvCell(lead.status),
        escapeCsvCell(lead.last_contacted_at ?? ""),
        escapeCsvCell((lead as { next_follow_up_at?: string | null }).next_follow_up_at ?? ""),
      ].join(",")
    );

    const csv = [header.join(","), ...csvRows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download =
      tab === "existing"
        ? `existing-customers-queue-${dateStamp}.csv`
        : tab === "chasing"
          ? `chasing-queue-${dateStamp}.csv`
          : `new-leads-queue-${dateStamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const buttonClass =
    "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 active:scale-[0.98]";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-semibold text-slate-900">Export Queue Lists</h2>
        <p className="mt-1 text-sm text-slate-700">
          Download the current CRM queue groups as CSV files for checking against
          accounts or sharing offline.
        </p>
      </div>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <button
          type="button"
          onClick={() => downloadQueueCsv("existing")}
          className={buttonClass}
        >
          Export Existing Customers ({exportCounts.existing})
        </button>
        <button
          type="button"
          onClick={() => downloadQueueCsv("chasing")}
          className={buttonClass}
        >
          Export Chasing ({exportCounts.chasing})
        </button>
        <button
          type="button"
          onClick={() => downloadQueueCsv("new_leads")}
          className={buttonClass}
        >
          Export New Leads ({exportCounts.newLeads})
        </button>
      </div>
    </div>
  );
}
