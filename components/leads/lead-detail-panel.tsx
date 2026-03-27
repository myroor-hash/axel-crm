"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type {
  InvoiceSummary,
  LeadDetail,
  LeadEmailSummary,
  LeadNoteSummary,
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
  onSaveLeadDetails,
  activities,
  invoices,
  emails,
  notes,
  lastAction,
  onOpenPreparedEmail,
  emailComposer,
  isEmailComposerOpen = false,
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
  onSaveLeadDetails: (
    leadId: string,
    payload: {
      shopName: string;
      contactFirstName?: string | null;
      contactLastName?: string | null;
      phoneNumber: string;
      email?: string | null;
      addressLine1?: string | null;
      addressLine2?: string | null;
      addressLine3?: string | null;
      townCity?: string | null;
      countyRegion?: string | null;
      postcode?: string | null;
    }
  ) => Promise<void>;
  activities: Activity[];
  invoices: InvoiceSummary[];
  emails: LeadEmailSummary[];
  notes: LeadNoteSummary[];
  lastAction: string | null;
  onOpenPreparedEmail: (leadId: string) => void;
  emailComposer?: ReactNode;
  isEmailComposerOpen?: boolean;
}) {
  const [note, setNote] = useState("");
  const [manualFollowUpAt, setManualFollowUpAt] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [followUpError, setFollowUpError] = useState<string | null>(null);
  const [isSavingFollowUp, setIsSavingFollowUp] = useState(false);
  const [isRecordingOutcome, setIsRecordingOutcome] = useState(false);
  const [showNoAnswerPrompt, setShowNoAnswerPrompt] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [showEditDetails, setShowEditDetails] = useState(false);
  const [showInvoices, setShowInvoices] = useState(false);
  const [showEmailHistory, setShowEmailHistory] = useState(false);
  const [showActivities, setShowActivities] = useState(false);
  const [shopName, setShopName] = useState("");
  const [contactFirstName, setContactFirstName] = useState("");
  const [contactLastName, setContactLastName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [emailAddress, setEmailAddress] = useState("");
  const [addressLine1, setAddressLine1] = useState("");
  const [addressLine2, setAddressLine2] = useState("");
  const [addressLine3, setAddressLine3] = useState("");
  const [townCity, setTownCity] = useState("");
  const [countyRegion, setCountyRegion] = useState("");
  const [postCode, setPostCode] = useState("");
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [isSavingDetails, setIsSavingDetails] = useState(false);
  const noteInputRef = useRef<HTMLTextAreaElement | null>(null);
  const emailSectionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!lead || !isEmailComposerOpen || !emailSectionRef.current) {
      return;
    }

    emailSectionRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [isEmailComposerOpen, lead]);

  useEffect(() => {
    if (!lead) {
      return;
    }

    setShopName(lead.shop_name ?? "");
    setContactFirstName(lead.contact_first_name ?? "");
    setContactLastName(lead.contact_last_name ?? "");
    setPhoneNumber(lead.phone_number ?? "");
    setEmailAddress(lead.email ?? "");
    setAddressLine1(lead.address_line_1 ?? "");
    setAddressLine2(lead.address_line_2 ?? "");
    setAddressLine3(lead.address_line_3 ?? "");
    setTownCity(lead.town_city ?? "");
    setCountyRegion(lead.county_region ?? "");
    setPostCode(lead.postcode ?? "");
    setDetailsError(null);
  }, [lead]);

  if (!lead) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">Select a Lead</h2>
      </div>
    );
  }

  const activeLead = lead;
  const isReadOnly = readOnlyState?.isReadOnly ?? false;
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

  async function handleSaveDetails() {
    if (isReadOnly || isSavingDetails) return;

    if (!shopName.trim() || !phoneNumber.trim()) {
      setDetailsError("Shop name and phone number are required.");
      return;
    }

    setIsSavingDetails(true);
    setDetailsError(null);

    try {
      await onSaveLeadDetails(activeLead.id, {
        shopName,
        contactFirstName,
        contactLastName,
        phoneNumber,
        email: emailAddress,
        addressLine1,
        addressLine2,
        addressLine3,
        townCity,
        countyRegion,
        postcode: postCode,
      });
      setShowEditDetails(false);
    } catch (error) {
      setDetailsError(
        error instanceof Error ? error.message : "Unable to update lead details."
      );
    } finally {
      setIsSavingDetails(false);
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

  function renderCollapsibleHeader(
    title: string,
    countLabel: string,
    isOpen: boolean,
    onToggle: () => void
  ) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:bg-slate-100"
      >
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">{countLabel}</p>
        </div>
        <span className="text-sm font-medium text-slate-600">
          {isOpen ? "Hide ▲" : "Show ▼"}
        </span>
      </button>
    );
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

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase text-slate-500">Contact</p>
            <p className="font-medium text-slate-900">{contactName}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Phone</p>
            <p className="font-medium text-slate-900">{activeLead.phone_number}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Email</p>
            <p className="font-medium text-slate-900">{activeLead.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-slate-500">Customer Number</p>
            <p className="font-medium text-slate-900">
              {activeLead.customer_number ?? activeLead.external_ref ?? "—"}
            </p>
          </div>
        </div>
        <div className="mt-3 border-t border-slate-200 pt-3">
          <p className="text-xs uppercase text-slate-500">Location</p>
          <p className="font-medium text-slate-900">
            {[activeLead.town_city, activeLead.county_region, activeLead.postcode]
              .filter(Boolean)
              .join(", ") || "—"}
          </p>
        </div>

        <div className="mt-4">
          {renderCollapsibleHeader(
            "Edit Details",
            "Update contact, phone, email, or address",
            showEditDetails,
            () => setShowEditDetails((prev) => !prev)
          )}
          {showEditDetails ? (
            <div className="mt-3 rounded-xl border border-slate-200 bg-white px-4 py-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  disabled={isReadOnly || isSavingDetails}
                  placeholder="Shop name"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
                />
                <input
                  type="text"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={isReadOnly || isSavingDetails}
                  placeholder="Phone number"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
                />
                <input
                  type="text"
                  value={contactFirstName}
                  onChange={(e) => setContactFirstName(e.target.value)}
                  disabled={isReadOnly || isSavingDetails}
                  placeholder="Contact first name"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
                />
                <input
                  type="text"
                  value={contactLastName}
                  onChange={(e) => setContactLastName(e.target.value)}
                  disabled={isReadOnly || isSavingDetails}
                  placeholder="Contact last name"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
                />
                <input
                  type="email"
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  disabled={isReadOnly || isSavingDetails}
                  placeholder="Email address"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50 sm:col-span-2"
                />
                <input
                  type="text"
                  value={addressLine1}
                  onChange={(e) => setAddressLine1(e.target.value)}
                  disabled={isReadOnly || isSavingDetails}
                  placeholder="Address line 1"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50 sm:col-span-2"
                />
                <input
                  type="text"
                  value={addressLine2}
                  onChange={(e) => setAddressLine2(e.target.value)}
                  disabled={isReadOnly || isSavingDetails}
                  placeholder="Address line 2"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50 sm:col-span-2"
                />
                <input
                  type="text"
                  value={addressLine3}
                  onChange={(e) => setAddressLine3(e.target.value)}
                  disabled={isReadOnly || isSavingDetails}
                  placeholder="Address line 3"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50 sm:col-span-2"
                />
                <input
                  type="text"
                  value={townCity}
                  onChange={(e) => setTownCity(e.target.value)}
                  disabled={isReadOnly || isSavingDetails}
                  placeholder="Town / City"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
                />
                <input
                  type="text"
                  value={countyRegion}
                  onChange={(e) => setCountyRegion(e.target.value)}
                  disabled={isReadOnly || isSavingDetails}
                  placeholder="County / Region"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50"
                />
                <input
                  type="text"
                  value={postCode}
                  onChange={(e) => setPostCode(e.target.value)}
                  disabled={isReadOnly || isSavingDetails}
                  placeholder="Postcode"
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 disabled:opacity-50 sm:col-span-2"
                />
              </div>
              <div className="mt-3 flex items-center justify-between gap-3">
                {detailsError ? (
                  <p className="text-sm font-medium text-red-700">{detailsError}</p>
                ) : (
                  <div />
                )}
                <button
                  type="button"
                  onClick={handleSaveDetails}
                  disabled={isReadOnly || isSavingDetails}
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSavingDetails ? "Saving..." : "Save Details"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-6 border-t pt-6">
        <div className={sectionHeaderClass}>Call Outcome</div>
        <div className="grid gap-2 md:grid-cols-4">
          <button
            type="button"
            disabled={isReadOnly || isRecordingOutcome}
            onClick={() => handleOutcome("No Answer")}
            className={`${outcomeButtonClass("No Answer")} w-full`}
          >
            No Answer
          </button>
          <button
            type="button"
            disabled={isReadOnly || isRecordingOutcome}
            onClick={() => handleOutcome("Spoke to Buyer")}
            className={`${outcomeButtonClass("Spoke to Buyer")} w-full`}
          >
            Spoke to Buyer
          </button>
          <button
            type="button"
            disabled={isReadOnly || isRecordingOutcome}
            onClick={() => handleOutcome("Send Info")}
            className={`${outcomeButtonClass("Send Info")} w-full`}
          >
            Send Info
          </button>
          <button
            type="button"
            disabled={isReadOnly || isRecordingOutcome}
            onClick={() => handleOutcome("Ordered Broth Bites")}
            className={`${outcomeButtonClass("Ordered Broth Bites")} w-full`}
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
        {renderCollapsibleHeader(
          "Notes",
          note.trim() ? "Draft note ready to save" : "Open to add a lead note",
          showNotes,
          () => setShowNotes((prev) => !prev)
        )}
        {showNotes ? (
          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Lead Note
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

            {notes.length > 0 ? (
              <div className="mt-4 space-y-3 border-t border-slate-200 pt-4">
                {notes.map((savedNote) => (
                  <div
                    key={savedNote.id}
                    className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900"
                  >
                    <div className="font-medium text-slate-900">
                      {savedNote.actor_name ? `Note - ${savedNote.actor_name}` : "Note"}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">
                      {formatEventTime(savedNote.created_at) ?? "Unknown time"}
                    </div>
                    <div className="mt-1 text-slate-900">{savedNote.note_text}</div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-6 border-t pt-6">
        <div className={sectionHeaderClass}>Manual Follow-Up</div>
        <div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs uppercase text-slate-500">Callback Date & Time</p>
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
      </div>

      <div ref={emailSectionRef} className="mt-6 border-t pt-6">
        <div className={sectionHeaderClass}>Email</div>
        {!emailComposer ? (
          <p className="text-sm text-slate-500">
            Use the call outcome buttons to open the prepared email composer.
          </p>
        ) : null}
        {emailComposer ? <div className="mt-4">{emailComposer}</div> : null}
      </div>

      <div className="mt-6 border-t pt-6">
        {renderCollapsibleHeader(
          "Previous Invoices",
          `${invoices.length} recent invoice${invoices.length === 1 ? "" : "s"}`,
          showInvoices,
          () => setShowInvoices((prev) => !prev)
        )}
        {showInvoices ? (
          invoices.length === 0 ? (
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
          )
        ) : null}
      </div>

      <div className="mt-6 border-t pt-6">
        {renderCollapsibleHeader(
          "Email History",
          `${emails.length} recent email${emails.length === 1 ? "" : "s"}`,
          showEmailHistory,
          () => setShowEmailHistory((prev) => !prev)
        )}
        {showEmailHistory ? (
          emails.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">
              No emails sent yet. Sent emails will appear here with delivery and
              engagement status.
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {emails.map((email) => (
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
          )
        ) : null}
      </div>

      <div className="mt-6 border-t pt-6">
        {renderCollapsibleHeader(
          "Activity Timeline",
          `${activities.length} recent activit${activities.length === 1 ? "y" : "ies"}`,
          showActivities,
          () => setShowActivities((prev) => !prev)
        )}
        {showActivities ? (
          <div className="mt-3 space-y-3">
            {activities.length === 0 ? (
              <p className="text-sm text-slate-500">No activity yet.</p>
            ) : null}
            {activities.map((activity, index) => (
              <div
                key={index}
                className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-900"
              >
                <div className="font-medium text-slate-900">
                  {activity.action}
                  {activity.actorName ? ` - ${activity.actorName}` : ""}
                </div>
                <div className="mt-1 text-xs text-slate-500">{activity.time}</div>
                {activity.note ? (
                  <div className="mt-1 text-slate-900">{activity.note}</div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
