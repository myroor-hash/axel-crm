"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { LeadList } from "@/components/leads/lead-list";
import { LeadDetailPanel } from "@/components/leads/lead-detail-panel";
import { NextLeadButton } from "@/components/leads/next-lead-button";
import { EmailComposePanel } from "@/components/leads/email-compose-panel";
import {
  fetchCallsTodayCount,
  fetchLeadActivities,
  fetchLeadById,
  fetchLeadEmails,
  fetchLeadInvoices,
  fetchLeadQueue,
  recordCallOutcome,
  recordEmailSent,
  sendLeadEmail,
  type DbActivity,
} from "@/features/leads/queries";
import { getLeadReadOnlyState } from "@/features/locks/queries";
import { fetchAttachmentOptions } from "@/features/attachments/queries";
import { LogoutButton } from "@/components/auth/logout-button";
import type {
  InvoiceSummary,
  LeadDetail,
  LeadEmailSummary,
  LeadQueueItem,
} from "@/features/leads/types";
import type { LeadReadOnlyState } from "@/features/locks/types";
import type { AttachmentOption } from "@/features/attachments/types";

type Activity = {
  time: string;
  action: string;
  note?: string;
};

type ContactState = {
  lastContactAt?: string;
  followUpAt?: string;
  statusLabel?: string;
};

type PanelMode = "lead" | "email";
type QueueTab = "existing" | "chasing" | "new_leads";

function mapDbActivities(rows: DbActivity[]): Activity[] {
  return rows.map((row) => ({
    time: new Date(row.created_at).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    action: row.action_label,
    note: row.note_text ?? undefined,
  }));
}

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

export default function ProtectedHomePage() {
  const [, setQueueClock] = useState(() => Date.now());
  const [baseQueue, setBaseQueue] = useState<LeadQueueItem[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [readOnlyState, setReadOnlyState] = useState<LeadReadOnlyState | null>(null);
  const [invoiceMap, setInvoiceMap] = useState<Record<string, InvoiceSummary[]>>({});
  const [emailMap, setEmailMap] = useState<Record<string, LeadEmailSummary[]>>({});
  const [activityMap, setActivityMap] = useState<Record<string, Activity[]>>({});
  const [lastActionMap, setLastActionMap] = useState<Record<string, string | null>>({});
  const [contactStateMap, setContactStateMap] = useState<Record<string, ContactState>>({});
  const [showUnfinishedWarning, setShowUnfinishedWarning] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("lead");
  const [attachments, setAttachments] = useState<AttachmentOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [queueTab, setQueueTab] = useState<QueueTab>("existing");
  const [callsTodayCount, setCallsTodayCount] = useState(0);

  useEffect(() => {
    async function loadQueue() {
      const rows = await fetchLeadQueue();
      setBaseQueue(rows);

      if (rows.length === 0) {
        setSelectedLeadId(null);
        return;
      }

      const firstUnlocked = rows.find((lead) => !lead.is_locked);
      setSelectedLeadId(firstUnlocked?.id ?? rows[0].id);
    }

    async function loadAttachments() {
      const files = await fetchAttachmentOptions();
      setAttachments(files);
    }

    async function loadCallsTodayCount() {
      const count = await fetchCallsTodayCount();
      setCallsTodayCount(count);
    }

    loadQueue();
    loadAttachments();
    loadCallsTodayCount();
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setQueueClock(Date.now());
    }, 30000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    async function loadLead() {
      if (!selectedLeadId) {
        setSelectedLead(null);
        setReadOnlyState(null);
        return;
      }

      const [lead, lockState] = await Promise.all([
        fetchLeadById(selectedLeadId),
        getLeadReadOnlyState(selectedLeadId),
      ]);

      setSelectedLead(lead);
      setReadOnlyState(lockState);
    }

    loadLead();
  }, [selectedLeadId]);

  useEffect(() => {
    async function loadActivities() {
      if (!selectedLeadId) return;

      const dbRows = await fetchLeadActivities(selectedLeadId);
      const mapped = mapDbActivities(dbRows);

      setActivityMap((prev) => ({
        ...prev,
        [selectedLeadId]: mapped,
      }));

      setLastActionMap((prev) => ({
        ...prev,
        [selectedLeadId]: mapped[0]?.action ?? null,
      }));
    }

    loadActivities();
  }, [selectedLeadId]);

  useEffect(() => {
    async function loadInvoices() {
      if (!selectedLeadId || !selectedLead) {
        return;
      }

      const rows = await fetchLeadInvoices(selectedLead);
      setInvoiceMap((prev) => ({
        ...prev,
        [selectedLeadId]: rows,
      }));
    }

    loadInvoices();
  }, [selectedLead, selectedLeadId]);

  useEffect(() => {
    async function loadEmails() {
      if (!selectedLeadId) {
        return;
      }

      const rows = await fetchLeadEmails(selectedLeadId);
      setEmailMap((prev) => ({
        ...prev,
        [selectedLeadId]: rows,
      }));
    }

    loadEmails();
  }, [selectedLeadId]);

  const queue = useMemo(() => {
    const now = new Date();

    function enrichLead(lead: LeadQueueItem) {
      const contactState = contactStateMap[lead.id];
      const lastContactAt =
        contactState?.lastContactAt ??
        lead.last_contacted_at ??
        lead.last_activity_at ??
        null;
      const followUpAt =
        contactState?.followUpAt ?? lead.next_follow_up_at ?? null;
      const hasRecordedOutcome = Boolean(lead.last_outcome || lead.last_activity_label);
      const hasContactHistory = Boolean(lastContactAt || hasRecordedOutcome);

      const followUpDue =
        Boolean(followUpAt) && new Date(followUpAt as string).getTime() <= now.getTime();
      const clickedRecently =
        Boolean(lead.recent_email_clicked_at) &&
        now.getTime() - new Date(lead.recent_email_clicked_at as string).getTime() <=
          24 * 60 * 60 * 1000;

      let statusBadge = "Not Contacted";
      if (clickedRecently) {
        statusBadge = "Clicked Info";
      } else if (contactState?.statusLabel) {
        statusBadge = contactState.statusLabel;
      } else if (followUpDue) {
        statusBadge = "Follow Up Due";
      } else if (followUpAt) {
        statusBadge = "Follow Up Scheduled";
      } else if (hasContactHistory) {
        statusBadge = "Contacted";
      }

      const neverContacted = !hasContactHistory;
      const followUpScheduled = Boolean(followUpAt) && !followUpDue;

      let priority = 4;
      if (clickedRecently) priority = 0;
      else if (followUpDue) priority = 1;
      else if (followUpScheduled) priority = 2;
      else if (neverContacted) priority = 3;

      return {
        ...lead,
        computed_has_contact_history: hasContactHistory,
        last_contacted_at: lastContactAt,
        computed_follow_up_at: followUpAt,
        computed_follow_up_due: followUpDue,
        computed_status_badge: statusBadge,
        computed_priority: priority,
      };
    }

    return [...baseQueue]
      .map(enrichLead)
      .sort((a, b) => {
        if (a.computed_priority !== b.computed_priority) {
          return a.computed_priority - b.computed_priority;
        }

        if (a.computed_priority === 0) {
          const aTime = a.recent_email_clicked_at
            ? new Date(a.recent_email_clicked_at).getTime()
            : 0;
          const bTime = b.recent_email_clicked_at
            ? new Date(b.recent_email_clicked_at).getTime()
            : 0;
          return bTime - aTime;
        }

        if (a.computed_priority === 1) {
          const aTime = a.computed_follow_up_at ? new Date(a.computed_follow_up_at).getTime() : Infinity;
          const bTime = b.computed_follow_up_at ? new Date(b.computed_follow_up_at).getTime() : Infinity;
          return aTime - bTime;
        }

        if (a.computed_priority === 2) {
          const aTime = a.computed_follow_up_at ? new Date(a.computed_follow_up_at).getTime() : Infinity;
          const bTime = b.computed_follow_up_at ? new Date(b.computed_follow_up_at).getTime() : Infinity;
          return aTime - bTime;
        }

        if (a.computed_priority === 3) {
          const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
          const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
          return bTime - aTime;
        }

        const aTime = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
        const bTime = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
        return aTime - bTime;
      });
  }, [baseQueue, contactStateMap]);

  const tabQueue = useMemo(
    () => queue.filter((lead) => matchesQueueTab(lead, queueTab)),
    [queue, queueTab]
  );

  const filteredQueue = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return tabQueue;

    return tabQueue.filter((lead) => {
      const haystack = [
        lead.shop_name,
        lead.contact_name,
        lead.phone_number,
        lead.postcode,
        lead.town_city,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [tabQueue, searchTerm]);

  const visibleQueue = useMemo(() => filteredQueue.slice(0, 20), [filteredQueue]);

  const nextAvailableLeadId = useMemo(() => {
    if (tabQueue.length === 0) return null;

    const unlockedQueue = tabQueue.filter((lead) => !lead.is_locked);
    if (unlockedQueue.length === 0) return selectedLeadId;

    if (!selectedLeadId) return unlockedQueue[0].id;

    const currentIndex = tabQueue.findIndex((lead) => lead.id === selectedLeadId);
    if (currentIndex === -1) return unlockedQueue[0].id;

    for (let i = currentIndex + 1; i < tabQueue.length; i += 1) {
      if (!tabQueue[i].is_locked) return tabQueue[i].id;
    }

    for (let i = 0; i < currentIndex; i += 1) {
      if (!tabQueue[i].is_locked) return tabQueue[i].id;
    }

    return selectedLeadId;
  }, [selectedLeadId, tabQueue]);

  function handleAdvanceLead() {
    if (!nextAvailableLeadId) return;
    setPanelMode("lead");
    setSelectedLeadId(nextAvailableLeadId);
  }

  function handleSelectLead(leadId: string) {
    setPanelMode("lead");
    setSelectedLeadId(leadId);
    setShowUnfinishedWarning(false);
  }

  function handleSelectQueueTab(tab: QueueTab) {
    setQueueTab(tab);

    const nextTabQueue = queue.filter((lead) => matchesQueueTab(lead, tab));

    if (nextTabQueue.length === 0) {
      setSelectedLeadId(null);
      return;
    }

    if (selectedLeadId && nextTabQueue.some((lead) => lead.id === selectedLeadId)) {
      return;
    }

    const firstUnlocked = nextTabQueue.find((lead) => !lead.is_locked);
    setSelectedLeadId(firstUnlocked?.id ?? nextTabQueue[0].id);
  }

  function handleExportCurrentTab() {
    const rows = tabQueue.map((lead) =>
      [
        lead.customer_number ?? "",
        lead.shop_name,
        lead.contact_name ?? "",
        preserveCsvText(lead.phone_number),
        lead.postcode ?? "",
        lead.town_city ?? "",
        lead.computed_status_badge ?? lead.status,
        lead.last_contacted_at ?? "",
        lead.computed_follow_up_at ?? "",
      ]
        .map(escapeCsvCell)
        .join(",")
    );

    const csv = [
      [
        "customer_number",
        "shop_name",
        "contact_name",
        "phone_number",
        "postcode",
        "town_city",
        "status",
        "last_contacted_at",
        "follow_up_at",
      ].join(","),
      ...rows,
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateStamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    const filePrefix =
      queueTab === "existing"
        ? "existing-customers"
        : queueTab === "chasing"
          ? "chasing"
          : "new-leads";
    link.download = `${filePrefix}-queue-${dateStamp}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  const refreshQueue = useCallback(
    async (preferredLeadId?: string | null) => {
      const rows = await fetchLeadQueue();
      setBaseQueue(rows);

      const targetLeadId = preferredLeadId ?? selectedLeadId;
      if (rows.length === 0) {
        setSelectedLeadId(null);
        return;
      }

      if (targetLeadId && rows.some((lead) => lead.id === targetLeadId)) {
        setSelectedLeadId(targetLeadId);
        return;
      }

      const firstUnlocked = rows.find((lead) => !lead.is_locked);
      setSelectedLeadId(firstUnlocked?.id ?? rows[0].id);
    },
    [selectedLeadId]
  );

  async function handleRecordActivity(
    leadId: string,
    action: string,
    note?: string,
    followUpAt?: string
  ) {
    const now = new Date();
    const result = await recordCallOutcome({
      leadId,
      actionLabel: action,
      noteText: note,
      previousStatus: selectedLead?.status ?? null,
      manualFollowUpAt: followUpAt ?? null,
    });

    const newActivity: Activity = {
      time: now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      action,
      note: note || undefined,
    };

    setActivityMap((prev) => ({
      ...prev,
      [leadId]: [newActivity, ...(prev[leadId] ?? [])],
    }));

    setLastActionMap((prev) => ({
      ...prev,
      [leadId]: action,
    }));

    setContactStateMap((prev) => {
      const existing = prev[leadId] ?? {};
      const statusLabel =
        Boolean(result.nextFollowUpAt)
          ? new Date(result.nextFollowUpAt as string).getTime() <= Date.now()
            ? "Follow Up Due"
            : "Follow Up Scheduled"
          : "Contacted";
      const followUpAt = result.nextFollowUpAt ?? undefined;

      return {
        ...prev,
        [leadId]: {
          ...existing,
          lastContactAt: result.lastContactedAt,
          followUpAt,
          statusLabel,
        },
      };
    });

    await refreshQueue(leadId);
    const count = await fetchCallsTodayCount();
    setCallsTodayCount(count);
  }

  function handleOpenPreparedEmail() {
    setPanelMode("email");
  }

  async function handlePreparedEmailSend(payload: {
    subject: string;
    body: string;
    attachmentId: string;
  }) {
    if (!selectedLeadId) return;
    if (!selectedLead?.email) {
      throw new Error("This lead does not have an email address yet.");
    }

    const attachment = attachments.find((file) => file.id === payload.attachmentId);
    const action = `Email Sent${attachment ? ` — ${attachment.label}` : ""}`;

    await sendLeadEmail({
      leadId: selectedLeadId,
      to: selectedLead.email,
      subject: payload.subject,
      body: payload.body,
      attachmentId: payload.attachmentId,
      attachmentName: attachment?.label ?? "",
    });

    const result = await recordEmailSent({
      leadId: selectedLeadId,
      actionLabel: action,
      noteText: payload.subject,
      previousStatus: selectedLead?.status ?? null,
    });

    const now = new Date();
    const activity: Activity = {
      time: now.toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      }),
      action,
      note: payload.subject,
    };

    setActivityMap((prev) => ({
      ...prev,
      [selectedLeadId]: [activity, ...(prev[selectedLeadId] ?? [])],
    }));

    setLastActionMap((prev) => ({
      ...prev,
      [selectedLeadId]: action,
    }));

    setContactStateMap((prev) => ({
      ...prev,
      [selectedLeadId]: {
        ...(prev[selectedLeadId] ?? {}),
        followUpAt: result.nextFollowUpAt ?? undefined,
        statusLabel: "Follow Up Scheduled",
      },
    }));

    await refreshQueue(selectedLeadId);

    const updatedEmails = await fetchLeadEmails(selectedLeadId);
    setEmailMap((prev) => ({
      ...prev,
      [selectedLeadId]: updatedEmails,
    }));

    setPanelMode("lead");

    setTimeout(() => {
      handleAdvanceLead();
    }, 250);
  }

  function handleCallNextLead() {
    if (!selectedLeadId) {
      handleAdvanceLead();
      return;
    }

    const currentActivities = activityMap[selectedLeadId] ?? [];
    if (currentActivities.length === 0) {
      setShowUnfinishedWarning(true);
      return;
    }

    setShowUnfinishedWarning(false);
    handleAdvanceLead();
  }

  function handleContinueAnyway() {
    setShowUnfinishedWarning(false);
    handleAdvanceLead();
  }

  function handleStayOnLead() {
    setShowUnfinishedWarning(false);
  }

  const selectedLeadActivities = selectedLeadId ? activityMap[selectedLeadId] ?? [] : [];
  const selectedLeadInvoices = selectedLeadId ? invoiceMap[selectedLeadId] ?? [] : [];
  const selectedLeadEmails = selectedLeadId ? emailMap[selectedLeadId] ?? [] : [];
  const selectedLeadLastAction = selectedLeadId ? lastActionMap[selectedLeadId] ?? null : null;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <PageHeader
          title="Call Queue"
          description="Follow-ups first, then untouched leads, then oldest contacted leads."
          actions={
            <div className="flex w-full max-w-xl flex-col gap-3 md:items-end">
              <div className="w-full">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                  Search Contacts
                </label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by business, contact, phone, postcode, or town..."
                  className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={handleExportCurrentTab}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 active:scale-[0.98]"
                >
                  Export{" "}
                  {queueTab === "existing"
                    ? "Existing"
                    : queueTab === "chasing"
                      ? "Chasing"
                      : "New Leads"}{" "}
                  CSV
                </button>
                <NextLeadButton onClick={handleCallNextLead} />
                <LogoutButton />
              </div>
            </div>
          }
        />

        {showUnfinishedWarning ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-4">
            <p className="text-sm font-medium text-amber-900">
              You haven’t recorded an outcome for this lead yet.
            </p>
            <p className="mt-1 text-sm text-amber-800">
              Do you want to continue to the next lead anyway?
            </p>

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleContinueAnyway}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
              >
                Continue Anyway
              </button>

              <button
                type="button"
                onClick={handleStayOnLead}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
              >
                Stay on Lead
              </button>
            </div>
          </div>
        ) : null}

        <section className="grid gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm md:grid-cols-4">
          <div className="text-center text-sm text-slate-600">
            Calls Today :{" "}
            <span className="text-base font-semibold text-slate-900">
              {callsTodayCount}
            </span>
          </div>
          <div className="text-center text-sm text-slate-600">
            {queueTab === "existing"
              ? "Existing Customers"
              : queueTab === "chasing"
                ? "Chasing"
                : "New Leads"}{" "}
            :{" "}
            <span className="text-base font-semibold text-slate-900">
              {filteredQueue.length}
            </span>
          </div>
          <div className="text-center text-sm text-slate-600">
            Follow Ups :{" "}
            <span className="text-base font-semibold text-slate-900">
              {queue.filter((lead) => Boolean(lead.computed_follow_up_at)).length}
            </span>
          </div>
          <div className="text-center text-sm text-slate-600">
            Broth Bites Ordered :{" "}
            <span className="text-base font-semibold text-slate-900">
              {queue.filter((lead) => lead.last_outcome === "converted_to_customer").length}
            </span>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => handleSelectQueueTab("existing")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              queueTab === "existing"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Existing Customers ({queue.filter((lead) => lead.has_invoice_history).length})
          </button>
          <button
            type="button"
            onClick={() => handleSelectQueueTab("chasing")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              queueTab === "chasing"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Chasing ({queue.filter((lead) => !lead.has_invoice_history && lead.computed_has_contact_history).length})
          </button>
          <button
            type="button"
            onClick={() => handleSelectQueueTab("new_leads")}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
              queueTab === "new_leads"
                ? "bg-slate-900 text-white"
                : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            New Leads ({queue.filter((lead) => !lead.has_invoice_history && !lead.computed_has_contact_history).length})
          </button>
        </div>

        <section className="grid gap-6 lg:grid-cols-2">
          <LeadList
            leads={visibleQueue}
            selectedLeadId={selectedLeadId}
            onSelectLead={handleSelectLead}
          />

          {panelMode === "email" && selectedLead ? (
            <EmailComposePanel
              lead={selectedLead}
              attachments={attachments}
              onCancel={() => setPanelMode("lead")}
              onSend={handlePreparedEmailSend}
            />
          ) : (
            <LeadDetailPanel
              key={selectedLead?.id ?? "no-lead"}
              lead={selectedLead}
              readOnlyState={readOnlyState}
              onAdvanceLead={handleAdvanceLead}
              onRecordActivity={handleRecordActivity}
              activities={selectedLeadActivities}
              invoices={selectedLeadInvoices}
              emails={selectedLeadEmails}
              lastAction={selectedLeadLastAction}
              onOpenPreparedEmail={handleOpenPreparedEmail}
            />
          )}
        </section>
      </div>
    </main>
  );
}
