"use client";

import { useRef, useState, type ReactNode } from "react";
import type {
  InvoiceSummary,
  LeadDetail,
  LeadEmailSummary,
} from "@/features/leads/types";
import type { LeadReadOnlyState } from "@/features/locks/types";

type Activity = {
  time: string;
  action: string;
  note?: string;
  actorName?: string;
};

export function LeadDetailPanel({
  lead,
  readOnlyState,
  onRecordActivity,
  onSaveNote,
  onScheduleFollowUp,
  activities,
  invoices,
  emails,
  lastAction,
  onOpenPreparedEmail,
  emailComposer,
}: {
  lead: LeadDetail | null;
  readOnlyState: LeadReadOnlyState | null;
  onRecordActivity: (
    leadId: string,
    action: string,
    note?: string,
    followUpAt?: string
  ) => void;
  onSaveNote: (leadId: string, noteText: string) => Promise<void>;
  onScheduleFollowUp: (leadId: string, followUpAt: string) => Promise<void>;
  activities: Activity[];
  invoices: InvoiceSummary[];
  emails: LeadEmailSummary[];
  lastAction: string | null;
  onOpenPreparedEmail: (leadId: string) => void;
  emailComposer?: ReactNode;
}) {
  const [note, setNote] = useState("");
  const [manualFollowUpAt, setManualFollowUpAt] = useState("");
  const [showAllEmails, setShowAllEmails] = useState(false);
  const [showAllActivities, setShowAllActivities] = useState(false);
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
  const [isRecordingOutcome, setIsRecordingOutcome] = useState(false);
  const [showNoAnswerPrompt, setShowNoAnswerPrompt] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);

  if (!lead) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Select a Lead</h2>
      </div>
    );
  }

  const activeLead = lead;
  const isReadOnly = readOnlyState?.isReadOnly ?? false;
  const visibleEmails = showAllEmails ? emails : emails.slice(0, 1);
  const visibleActivities = showAllActivities ? activities : activities.slice(0, 2);
  const sectionHeaderClass =
    "mb-4 rounded-xl bg-slate-950 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-white";

  const contactName =
    [activeLead.contact_first_name, activeLead.contact_last_name]
      .filter(Boolean)
      .join(" ") || "Unknown";

  async function submitOutcome(action: string, followUpAt?: string) {
    if (isReadOnly || isRecordingOutcome) return;

    setIsRecordingOutcome(true);

    try {
      const trimmedNote = note.trim();

      await onRecordActivity(
        activeLead.id,
        action,
        trimmedNote || undefined,
        followUpAt
      );

      setNote("");
      setManualFollowUpAt("");
      setShowNoAnswerPrompt(false);
    } finally {
      setIsRecordingOutcome(false);
    }
  }

  async function handleOutcome(action: string) {
    if (isReadOnly || isRecordingOutcome) return;

    setNoteError(null);
    setFollowUpError(null);
    setShowNoAnswerPrompt(false);

    if (action === "Send Info") {
      onOpenPreparedEmail(activeLead.id);
      return;
    }

    const scheduledFollowUpAt = manualFollowUpAt
      ? new Date(manualFollowUpAt).toISOString()
      : undefined;
    const trimmedNote = note.trim();

    if (action === "Gatekeeper" && !trimmedNote) {
      const message = "Please add a note before recording Gatekeeper.";
      setNoteError(message);
      window.alert(message);
      noteInputRef.current?.focus();
      return;
    }

    if (action === "No Answer" && !scheduledFollowUpAt) {
      setShowNoAnswerPrompt(true);
      return;
    }

    await submitOutcome(action, scheduledFollowUpAt);
  }

  async function handleSaveNote() {
    if (isReadOnly || isSavingNote) return;

    const trimmedNote = note.trim();
    if (!trimmedNote) {
      const message = "Please enter a note before saving it.";
      setNoteError(message);
      noteInputRef.current?.focus();
      return;
    }

    setIsSavingNote(true);
    setNoteError(null);

    try {
      await onSaveNote(activeLead.id, trimmedNote);
      setNote("");
    } catch (error) {
      setNoteError(
        error instanceof Error ? error.message : "Unable to save note."
      );
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleSaveFollowUp() {
    if (isReadOnly || isSavingFollowUp) return;

    if (!manualFollowUpAt) {
      setFollowUpError("Please choose a follow-up date and time before saving it.");
      return;
    }

    setIsSavingFollowUp(true);
    setFollowUpError(null);

    try {
      await onScheduleFollowUp(
        activeLead.id,
        new Date(manualFollowUpAt).toISOString()
      );
      setManualFollowUpAt("");
    } catch (error) {
      setFollowUpError(
        error instanceof Error ? error.message : "Unable to save follow-up."
      );
    } finally {
      setIsSavingFollowUp(false);
    }
  }

  function outcomeButtonClass(action: string) {
    const isSelected = lastAction === action;

    if (isSelected) {
      return "rounded-xl border border-slate-900 bg-slate-900 px-3 py-2 text-sm text-white shadow-sm transition disabled:opacity-50";
    }

    return "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-100 active:scale-[0.98] disabled:opacity-50";
  }

  function formatEventTime(value: string | null) {
    if (!value) return null;

    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="-mx-6 -mt-6 rounded-t-2xl bg-slate-950 px-6 py-5 text-white">
        <h2 className="text-xl font-semibold text-white">
          {activeLead.shop_name}
        </h2>
        {activeLead.lead_source_name ? (
          <p className="mt-2 text-sm font-medium text-slate-200">
            Source: {activeLead.lead_source_name}
          </p>
        ) : null}

        {isReadOnly ? (
          <p className="mt-1 text-sm text-slate-200">
            Read-only. Locked by {readOnlyState?.lockedByName ?? "another user"}
          </p>
        ) : null}
      </div>

      {emailComposer ? <div className="mt-6">{emailComposer}</div> : null}

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
        <div className={sectionHeaderClass}>Previous Invoices</div>
        <div className="flex items-center justify-between gap-3">
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
        <div className={sectionHeaderClass}>Email History</div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500">
              {emails.length} recent email{emails.length === 1 ? "" : "s"}
            </span>
            {emails.length > 1 ? (
              <button
                type="button"
                onClick={() => setShowAllEmails((prev) => !prev)}
                className="text-xs font-medium text-slate-600 transition hover:text-slate-900"
              >
                {showAllEmails ? "Hide ▲" : "Show All ▼"}
              </button>
            ) : null}
          </div>
        </div>

        {emails.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            No emails sent yet. Sent emails will appear here with delivery and
            engagement status.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {visibleEmails.map((email) => (
              <div
                key={email.id}
                className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {email.subject}
                    </p>
                    <p className="text-xs text-slate-500">
                      To {email.recipient_email}
                    </p>
                    {email.sent_by_name ? (
                      <p className="text-xs text-slate-500">
                        Sent by {email.sent_by_name}
                      </p>
                    ) : null}
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold capitalize text-slate-900">
                      {email.status}
                    </p>
                    <p className="text-xs text-slate-500">
                      Sent {formatEventTime(email.sent_at) ?? "unknown"}
                    </p>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
                  <span>
                    Delivered: {formatEventTime(email.delivered_at) ?? "—"}
                  </span>
                  <span>Opened: {formatEventTime(email.opened_at) ?? "—"}</span>
                  <span>Clicked: {formatEventTime(email.clicked_at) ?? "—"}</span>
                </div>

                {email.attachment_name ? (
                  <p className="mt-2 text-xs text-slate-600">
                    Links: {email.attachment_name}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-6 border-t pt-6">
        <div className={sectionHeaderClass}>Call Outcome</div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Note
            </p>
            <button
              type="button"
              onClick={handleSaveNote}
              disabled={isReadOnly || isSavingNote}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSavingNote ? "Saving..." : "Commit Note"}
            </button>
          </div>

          <textarea
            ref={noteInputRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={isReadOnly}
            className="mt-3 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-500 disabled:opacity-50"
            rows={3}
            placeholder="Add a note for this lead..."
          />

          {noteError ? (
            <p className="mt-2 text-sm font-medium text-red-700">{noteError}</p>
          ) : null}
        </div>

        <div className="mt-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase text-slate-500">Manual Follow-Up</p>
            <div className="flex items-center gap-3">
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
              <button
                type="button"
                onClick={handleSaveFollowUp}
                disabled={isReadOnly || isSavingFollowUp}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSavingFollowUp ? "Saving..." : "Commit Follow Up"}
              </button>
            </div>
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
          {followUpError ? (
            <p className="mt-2 text-sm font-medium text-red-700">{followUpError}</p>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isReadOnly || isRecordingOutcome}
            onClick={() => handleOutcome("No Answer")}
            className={outcomeButtonClass("No Answer")}
          >
            No Answer
          </button>

          <button
            type="button"
            disabled={isReadOnly || isRecordingOutcome}
            onClick={() => handleOutcome("Gatekeeper")}
            className={outcomeButtonClass("Gatekeeper")}
          >
            Gatekeeper
          </button>

          <button
            type="button"
            disabled={isReadOnly || isRecordingOutcome}
            onClick={() => handleOutcome("Spoke to Buyer")}
            className={outcomeButtonClass("Spoke to Buyer")}
          >
            Spoke to Buyer
          </button>

          <button
            type="button"
            disabled={isReadOnly || isRecordingOutcome}
            onClick={() => handleOutcome("Send Info")}
            className={outcomeButtonClass("Send Info")}
          >
            Send Info
          </button>

          <button
            type="button"
            disabled={isReadOnly || isRecordingOutcome}
            onClick={() => handleOutcome("Ordered Broth Bites")}
            className={outcomeButtonClass("Ordered Broth Bites")}
          >
            Ordered Broth Bites
          </button>
        </div>

        {showNoAnswerPrompt ? (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-slate-800">
            <p className="font-medium text-slate-900">
              Reappoint this follow-up for 24 hours from now?
            </p>
            <p className="mt-1 text-slate-600">
              Choose whether to book a new callback, clear the existing follow-up, or cancel.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={isRecordingOutcome}
                onClick={() =>
                  submitOutcome(
                    "No Answer",
                    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
                  )
                }
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Reappoint 24 Hours
              </button>
              <button
                type="button"
                disabled={isRecordingOutcome}
                onClick={() => submitOutcome("No Answer")}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:opacity-50"
              >
                No Follow Up
              </button>
              <button
                type="button"
                disabled={isRecordingOutcome}
                onClick={() => setShowNoAnswerPrompt(false)}
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}

        {lastAction ? (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
            ✓ Last action recorded: <span className="font-medium">{lastAction}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-6 border-t pt-6">
        <div className={sectionHeaderClass}>Activity Timeline</div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {activities.length} recent activit{activities.length === 1 ? "y" : "ies"}
          </span>
          {activities.length > 2 ? (
            <button
              type="button"
              onClick={() => setShowAllActivities((prev) => !prev)}
              className="text-xs font-medium text-slate-600 transition hover:text-slate-900"
            >
              {showAllActivities ? "Hide ▲" : "Show All ▼"}
            </button>
          ) : null}
        </div>

        <div className="mt-3 space-y-3">
          {activities.length === 0 && (
            <p className="text-sm text-slate-500">No activity yet.</p>
          )}

          {visibleActivities.map((a, i) => (
            <div
              key={i}
              className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900"
            >
              <div className="font-medium text-slate-900">
                {a.action}
                {a.actorName ? ` - ${a.actorName}` : ""}
              </div>
              <div className="mt-1 text-xs text-slate-500">{a.time}</div>
              {a.note ? <div className="mt-1 text-slate-900">{a.note}</div> : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
