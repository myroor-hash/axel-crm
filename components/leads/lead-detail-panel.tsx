"use client";

import { useState } from "react";
import type { InvoiceSummary, LeadDetail } from "@/features/leads/types";
import type { LeadReadOnlyState } from "@/features/locks/types";

type Activity = {
  time: string;
  action: string;
  note?: string;
};

export function LeadDetailPanel({
  lead,
  readOnlyState,
  onAdvanceLead,
  onRecordActivity,
  activities,
  invoices,
  lastAction,
  onOpenPreparedEmail,
}: {
  lead: LeadDetail | null;
  readOnlyState: LeadReadOnlyState | null;
  onAdvanceLead: () => void;
  onRecordActivity: (
    leadId: string,
    action: string,
    note?: string,
    followUpAt?: string
  ) => void;
  activities: Activity[];
  invoices: InvoiceSummary[];
  lastAction: string | null;
  onOpenPreparedEmail: (leadId: string) => void;
}) {
  const [note, setNote] = useState("");
  const [manualFollowUpAt, setManualFollowUpAt] = useState("");

  if (!lead) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Select a Lead</h2>
      </div>
    );
  }

  const activeLead = lead;
  const isReadOnly = readOnlyState?.isReadOnly ?? false;

  const contactName =
    [activeLead.contact_first_name, activeLead.contact_last_name]
      .filter(Boolean)
      .join(" ") || "Unknown";

  async function handleOutcome(action: string) {
    if (isReadOnly) return;

    const scheduledFollowUpAt = manualFollowUpAt
      ? new Date(manualFollowUpAt).toISOString()
      : undefined;

    await onRecordActivity(
      activeLead.id,
      action,
      note || undefined,
      scheduledFollowUpAt
    );

    if (action === "Send Info") {
      onOpenPreparedEmail(activeLead.id);
      return;
    }

    setNote("");
    setManualFollowUpAt("");

    setTimeout(() => {
      onAdvanceLead();
    }, 250);
  }

  function outcomeButtonClass(action: string) {
    const isSelected = lastAction === action;

    if (isSelected) {
      return "rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white shadow-sm transition disabled:opacity-50";
    }

    return "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50";
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-semibold text-slate-900">
          {activeLead.shop_name}
        </h2>

        <p className="mt-1 text-sm text-slate-600">
          {isReadOnly
            ? `Read-only. Locked by ${readOnlyState?.lockedByName ?? "another user"}`
            : "Editable lead"}
        </p>
      </div>

      <div className="mt-6 space-y-4 text-sm text-slate-700">
        <div>
          <p className="text-xs uppercase text-slate-500">Contact</p>
          <p>{contactName}</p>
        </div>

        <div>
          <p className="text-xs uppercase text-slate-500">Phone</p>
          <p>{activeLead.phone_number}</p>
        </div>

        <div>
          <p className="text-xs uppercase text-slate-500">Email</p>
          <p>{activeLead.email ?? "—"}</p>
        </div>

        <div>
          <p className="text-xs uppercase text-slate-500">Location</p>
          <p>
            {[activeLead.town_city, activeLead.county_region, activeLead.postcode]
              .filter(Boolean)
              .join(", ") || "—"}
          </p>
        </div>

        <div>
          <p className="text-xs uppercase text-slate-500">Customer Number</p>
          <p>{activeLead.customer_number ?? activeLead.external_ref ?? "—"}</p>
        </div>

        <div>
          <p className="text-xs uppercase text-slate-500">Priority Note</p>
          <p>{activeLead.priority_note ?? "—"}</p>
        </div>
      </div>

      <div className="mt-6 border-t pt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs uppercase text-slate-500">Previous Invoices</p>
          <span className="text-xs text-slate-500">
            {invoices.length} recent invoice{invoices.length === 1 ? "" : "s"}
          </span>
        </div>

        {invoices.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No invoice history linked yet. Once invoices are imported, this area
            will show previous order dates and values for this customer.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {invoice.invoice_ref}
                    </p>
                    <p className="text-xs text-slate-500">
                      {invoice.invoice_date
                        ? new Date(invoice.invoice_date).toLocaleDateString("en-GB", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "Date unknown"}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">
                      {invoice.total_amount ?? "—"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {[invoice.status, invoice.sent_status].filter(Boolean).join(" · ") ||
                        "Status unknown"}
                    </p>
                  </div>
                </div>

                {invoice.description ? (
                  <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                    {invoice.description}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 border-t pt-6">
        <p className="text-xs uppercase text-slate-500">Note</p>

        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          disabled={isReadOnly}
          className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
          rows={3}
          placeholder="Optional note..."
        />

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase text-slate-500">
              Manual Follow-Up
            </p>
            {manualFollowUpAt ? (
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => setManualFollowUpAt("")}
                className="text-xs font-medium text-slate-500 transition hover:text-slate-900 disabled:opacity-50"
              >
                Clear
              </button>
            ) : null}
          </div>
          <input
            type="datetime-local"
            value={manualFollowUpAt}
            onChange={(e) => setManualFollowUpAt(e.target.value)}
            disabled={isReadOnly}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
          />
          <p className="mt-2 text-xs text-slate-500">
            Use this when a buyer asks for a callback at a specific date and time.
          </p>
        </div>
      </div>

      <div className="mt-6 border-t pt-6">
        <p className="text-xs uppercase text-slate-500">Call Outcome</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => handleOutcome("No Answer")}
            className={outcomeButtonClass("No Answer")}
          >
            No Answer
          </button>

          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => handleOutcome("Gatekeeper")}
            className={outcomeButtonClass("Gatekeeper")}
          >
            Gatekeeper
          </button>

          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => handleOutcome("Spoke to Buyer")}
            className={outcomeButtonClass("Spoke to Buyer")}
          >
            Spoke to Buyer
          </button>

          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => handleOutcome("Send Info")}
            className={outcomeButtonClass("Send Info")}
          >
            Send Info
          </button>

          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => handleOutcome("Ordered Broth Bites")}
            className={outcomeButtonClass("Ordered Broth Bites")}
          >
            Ordered Broth Bites
          </button>
        </div>

        {lastAction ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            ✓ Last action recorded: <span className="font-medium">{lastAction}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-6 border-t pt-6">
        <p className="text-xs uppercase text-slate-500">Activity Timeline</p>

        <div className="mt-3 space-y-3">
          {activities.length === 0 && (
            <p className="text-sm text-slate-500">No activity yet.</p>
          )}

          {activities.map((a, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900"
            >
              <div className="font-medium text-slate-900">
                {a.time} — {a.action}
              </div>
              {a.note ? <div className="mt-1 text-slate-900">{a.note}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
