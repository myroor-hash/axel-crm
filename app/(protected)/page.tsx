"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { LeadList } from "@/components/leads/lead-list";
import { LeadDetailPanel } from "@/components/leads/lead-detail-panel";
import { NextLeadButton } from "@/components/leads/next-lead-button";
import { EmailComposePanel } from "@/components/leads/email-compose-panel";
import {
  fetchCallsTodayCount,
  fetchCurrentCrmActorName,
  fetchLeadActivities,
  fetchLeadById,
  fetchLeadEmails,
  fetchLeadInvoices,
  fetchLeadQueue,
  recordCallOutcome,
  recordEmailSent,
  recordLeadNote,
  scheduleLeadFollowUp,
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
  LeadQueueView,
} from "@/features/leads/types";
import type { LeadReadOnlyState } from "@/features/locks/types";
import type { AttachmentOption } from "@/features/attachments/types";

type Activity = {
  time: string;
  action: string;
  note?: string;
  actorName?: string;
};

type ContactState = {
  lastContactAt?: string;
  followUpAt?: string;
  statusLabel?: string;
};

type PanelMode = "lead" | "email";
type QueueTab = "existing" | "follow_up" | "new_leads";
const UK_TIME_ZONE = "Europe/London";

const QUEUE_TAB_META: Record<
  QueueTab,
  {
    title: string;
    description: string;
  }
> = {
  existing: {
    title: "Existing Customers",
    description: "These are customers who have bought product.",
  },
  follow_up: {
    title: "Follow Up",
    description: "These leads are due today or overdue for a callback.",
  },
  new_leads: {
    title: "New Leads (No Sales)",
    description: "These leads have no invoice history or sales yet.",
  },
};

function mapDbActivities(rows: DbActivity[]): Activity[] {
  return rows.map((row) => ({
    time: new Date(row.created_at).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    action: row.action_label,
    note: row.note_text ?? undefined,
    actorName: row.actor_name ?? undefined,
  }));
}

function getLondonDateKey(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: UK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;

  if (!year || !month || !day) {
    return null;
  }

  return `${year}-${month}-${day}`;
}

function mapActionToOutcome(action: string) {
  switch (action) {
    case "No Answer":
      return "no_answer";
    case "Gatekeeper":
      return "gatekeeper_only";
    case "Spoke to Buyer":
      return "spoke_to_buyer";
    case "Send Info":
      return "send_information";
    case "Ordered Broth Bites":
      return "converted_to_customer";
    default:
      return null;
  }
}

export default function ProtectedHomePage() {
  const [baseQueue, setBaseQueue] = useState<LeadQueueView[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [readOnlyState, setReadOnlyState] = useState<LeadReadOnlyState | null>(null);
  const [invoiceMap, setInvoiceMap] = useState<Record<string, InvoiceSummary[]>>({});
  const [emailMap, setEmailMap] = useState<Record<string, LeadEmailSummary[]>>({});
  const [activityMap, setActivityMap] = useState<Record<string, Activity[]>>({});
  const [lastActionMap, setLastActionMap] = useState<Record<string, string | null>>({});
  const [, setContactStateMap] = useState<Record<string, ContactState>>({});
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

  const queue = useMemo(() => baseQueue, [baseQueue]);

  const tabQueue = useMemo(
    () => queue.filter((lead) => lead.queue_bucket === queueTab),
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
  const existingQueueCount = useMemo(
    () => queue.filter((lead) => lead.queue_bucket === "existing").length,
    [queue]
  );
  const followUpQueueCount = useMemo(
    () => queue.filter((lead) => lead.queue_bucket === "follow_up").length,
    [queue]
  );
  const newLeadsQueueCount = useMemo(
    () => queue.filter((lead) => lead.queue_bucket === "new_leads").length,
    [queue]
  );
  const activeQueueMeta = QUEUE_TAB_META[queueTab];

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

    const nextTabQueue = queue.filter((lead) => lead.queue_bucket === tab);

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

  const refreshQueue = useCallback(
    async (preferredLeadId?: string | null) => {
      const rows = await fetchLeadQueue();
      setBaseQueue(rows);

      const targetLeadId = preferredLeadId ?? selectedLeadId;
      const activeTabRows = rows.filter((lead) => lead.queue_bucket === queueTab);
      if (rows.length === 0) {
        setSelectedLeadId(null);
        return rows;
      }

      if (
        targetLeadId &&
        activeTabRows.some((lead) => lead.id === targetLeadId)
      ) {
        setSelectedLeadId(targetLeadId);
        return rows;
      }

      if (preferredLeadId) {
        setSelectedLeadId(null);
        return rows;
      }

      if (activeTabRows.length === 0) {
        setSelectedLeadId(null);
        return rows;
      }

      const firstUnlocked = activeTabRows.find((lead) => !lead.is_locked);
      setSelectedLeadId(firstUnlocked?.id ?? activeTabRows[0].id);
      return rows;
    },
    [queueTab, selectedLeadId]
  );

  async function handleRecordActivity(
    leadId: string,
    action: string,
    note?: string,
    followUpAt?: string
  ) {
    const result = await recordCallOutcome({
      leadId,
      actionLabel: action,
      noteText: note,
      previousStatus: selectedLead?.status ?? null,
      manualFollowUpAt: followUpAt ?? null,
    });

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

    setSelectedLead((prev) =>
      prev && prev.id === leadId
        ? {
            ...prev,
            last_contacted_at: result.lastContactedAt,
            next_follow_up_at: result.nextFollowUpAt,
            status: result.status,
          }
        : prev
    );

    setBaseQueue((prev) => {
      const now = new Date();
      const todayKey = getLondonDateKey(now);

      return prev.map((lead) => {
        if (lead.id !== leadId) {
          return lead;
        }

        const nextFollowUpAt = result.nextFollowUpAt ?? null;
        const followUpDateKey = getLondonDateKey(nextFollowUpAt);
        const followUpAvailable = Boolean(
          followUpDateKey && todayKey && followUpDateKey <= todayKey
        );
        const followUpDue = Boolean(
          nextFollowUpAt && new Date(nextFollowUpAt).getTime() <= now.getTime()
        );

        const computedStatusBadge = followUpAvailable
          ? followUpDue
            ? "Follow Up Due"
            : "Follow Up Today"
          : nextFollowUpAt
            ? "Follow Up Booked"
            : "Contacted";

        const queueBucket = followUpAvailable
          ? "follow_up"
          : lead.has_invoice_history
            ? "existing"
            : "new_leads";

        return {
          ...lead,
          status: result.status,
          last_outcome: mapActionToOutcome(action),
          last_contacted_at: result.lastContactedAt,
          next_follow_up_at: nextFollowUpAt,
          computed_has_contact_history: true,
          computed_follow_up_at: nextFollowUpAt,
          computed_follow_up_available: followUpAvailable,
          computed_follow_up_due: followUpDue,
          computed_status_badge: computedStatusBadge,
          queue_bucket: queueBucket,
        };
      });
    });

    await refreshQueue(leadId);
    const refreshedActivities = await fetchLeadActivities(leadId);
    const currentActorName = await fetchCurrentCrmActorName();
    const mappedActivities = mapDbActivities(refreshedActivities);
    if (mappedActivities[0] && !mappedActivities[0].actorName && currentActorName) {
      mappedActivities[0] = {
        ...mappedActivities[0],
        actorName: currentActorName,
      };
    }
    setActivityMap((prev) => ({
      ...prev,
      [leadId]: mappedActivities,
    }));
    const count = await fetchCallsTodayCount();
    setCallsTodayCount(count);
  }

  async function handleSaveNote(leadId: string, noteText: string) {
    await recordLeadNote({
      leadId,
      noteText,
    });

    const refreshedActivities = await fetchLeadActivities(leadId);
    const currentActorName = await fetchCurrentCrmActorName();
    const mappedActivities = mapDbActivities(refreshedActivities);
    if (mappedActivities[0] && !mappedActivities[0].actorName && currentActorName) {
      mappedActivities[0] = {
        ...mappedActivities[0],
        actorName: currentActorName,
      };
    }
    setActivityMap((prev) => ({
      ...prev,
      [leadId]: mappedActivities,
    }));
  }

  async function handleScheduleFollowUp(leadId: string, followUpAt: string) {
    const result = await scheduleLeadFollowUp({
      leadId,
      followUpAt,
      previousStatus: selectedLead?.status ?? null,
    });

    setSelectedLead((prev) =>
      prev && prev.id === leadId
        ? {
            ...prev,
            next_follow_up_at: result.nextFollowUpAt,
            status: result.status,
          }
        : prev
    );

    setBaseQueue((prev) => {
      const now = new Date();
      const todayKey = getLondonDateKey(now);

      return prev.map((lead) => {
        if (lead.id !== leadId) {
          return lead;
        }

        const nextFollowUpAt = result.nextFollowUpAt;
        const followUpDateKey = getLondonDateKey(nextFollowUpAt);
        const followUpAvailable = Boolean(
          followUpDateKey && todayKey && followUpDateKey <= todayKey
        );
        const followUpDue = new Date(nextFollowUpAt).getTime() <= now.getTime();
        const computedStatusBadge = followUpAvailable
          ? followUpDue
            ? "Follow Up Due"
            : "Follow Up Today"
          : "Follow Up Booked";
        const queueBucket = followUpAvailable
          ? "follow_up"
          : lead.has_invoice_history
            ? "existing"
            : "new_leads";

        return {
          ...lead,
          status: result.status,
          next_follow_up_at: nextFollowUpAt,
          computed_follow_up_at: nextFollowUpAt,
          computed_follow_up_available: followUpAvailable,
          computed_follow_up_due: followUpDue,
          computed_status_badge: computedStatusBadge,
          queue_bucket: queueBucket,
        };
      });
    });

    setLastActionMap((prev) => ({
      ...prev,
      [leadId]: "Manual Follow Up Scheduled",
    }));

    await refreshQueue(leadId);
    const refreshedActivities = await fetchLeadActivities(leadId);
    const currentActorName = await fetchCurrentCrmActorName();
    const mappedActivities = mapDbActivities(refreshedActivities);
    if (mappedActivities[0] && !mappedActivities[0].actorName && currentActorName) {
      mappedActivities[0] = {
        ...mappedActivities[0],
        actorName: currentActorName,
      };
    }
    setActivityMap((prev) => ({
      ...prev,
      [leadId]: mappedActivities,
    }));
  }

  function handleOpenPreparedEmail() {
    setPanelMode("email");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handlePreparedEmailSend(payload: {
    subject: string;
    body: string;
    attachmentIds: string[];
  }) {
    if (!selectedLeadId) return;
    if (!selectedLead?.email) {
      throw new Error("This lead does not have an email address yet.");
    }

    const selectedAttachments = attachments.filter((file) =>
      payload.attachmentIds.includes(file.id)
    );
    const attachmentLabels = selectedAttachments.map((file) => file.label);
    const action = `Email Sent${attachmentLabels.length ? ` — ${attachmentLabels.join(", ")}` : ""}`;

    const emailSendResult = await sendLeadEmail({
      leadId: selectedLeadId,
      to: selectedLead.email,
      subject: payload.subject,
      body: payload.body,
      attachmentIds: payload.attachmentIds,
      attachmentName: attachmentLabels.join(", "),
    });

    const result = await recordEmailSent({
      leadId: selectedLeadId,
      actionLabel: action,
      noteText: payload.subject,
      actorName: emailSendResult.senderName,
      previousStatus: selectedLead?.status ?? null,
    });

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

    const refreshedActivities = await fetchLeadActivities(selectedLeadId);
    const currentActorName = await fetchCurrentCrmActorName();
    const activityActorName = emailSendResult.senderName ?? currentActorName;
    const mappedActivities = mapDbActivities(refreshedActivities);
    if (mappedActivities[0] && !mappedActivities[0].actorName && activityActorName) {
      mappedActivities[0] = {
        ...mappedActivities[0],
        actorName: activityActorName,
      };
    }
    setActivityMap((prev) => ({
      ...prev,
      [selectedLeadId]: mappedActivities,
    }));

    const updatedEmails = await fetchLeadEmails(selectedLeadId);
    setEmailMap((prev) => ({
      ...prev,
      [selectedLeadId]: updatedEmails,
    }));

    setPanelMode("lead");
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
          topRight={
            <div className="flex flex-col gap-2 md:items-end">
              <div className="w-full">
                <div className="flex items-center gap-3">
                  <label className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-slate-700">
                    Search Contacts
                  </label>
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by business, contact, phone, postcode, or town..."
                    className="min-w-0 flex-1 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-900"
                  />
                  <LogoutButton />
                </div>
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
              : queueTab === "follow_up"
                ? "Follow Up"
                : "New Leads (No Sales)"}{" "}
            :{" "}
            <span className="text-base font-semibold text-slate-900">
              {filteredQueue.length}
            </span>
          </div>
          <div className="text-center text-sm text-slate-600">
            Follow Ups Due :{" "}
            <span className="text-base font-semibold text-slate-900">
              {followUpQueueCount}
            </span>
          </div>
          <div className="text-center text-sm text-slate-600">
            Broth Bites Ordered :{" "}
            <span className="text-base font-semibold text-slate-900">
              {queue.filter((lead) => lead.last_outcome === "converted_to_customer").length}
            </span>
          </div>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3">
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
              Existing Customers ({existingQueueCount})
            </button>
            <button
              type="button"
              onClick={() => handleSelectQueueTab("follow_up")}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                followUpQueueCount > 0
                  ? queueTab === "follow_up"
                    ? "bg-red-600 text-white"
                    : "border border-red-300 bg-red-50 text-red-700 hover:bg-red-100"
                  : queueTab === "follow_up"
                    ? "bg-slate-900 text-white"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              Follow Up ({followUpQueueCount})
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
              New Leads (No Sales) ({newLeadsQueueCount})
            </button>
          </div>
          <NextLeadButton onClick={handleCallNextLead} />
        </div>

        <section className="grid gap-6 lg:grid-cols-2">
          <LeadList
            leads={visibleQueue}
            selectedLeadId={selectedLeadId}
            onSelectLead={handleSelectLead}
            title={activeQueueMeta.title}
            description={activeQueueMeta.description}
          />

          <div className="space-y-6">
            <LeadDetailPanel
              key={selectedLead?.id ?? "no-lead"}
              lead={selectedLead}
              readOnlyState={readOnlyState}
              onRecordActivity={handleRecordActivity}
              onSaveNote={handleSaveNote}
              onScheduleFollowUp={handleScheduleFollowUp}
              activities={selectedLeadActivities}
              invoices={selectedLeadInvoices}
              emails={selectedLeadEmails}
              lastAction={selectedLeadLastAction}
              onOpenPreparedEmail={handleOpenPreparedEmail}
              emailComposer={
                panelMode === "email" && selectedLead ? (
                  <EmailComposePanel
                    lead={selectedLead}
                    attachments={attachments}
                    onCancel={() => setPanelMode("lead")}
                    onSend={handlePreparedEmailSend}
                    embedded
                  />
                ) : null
              }
            />
          </div>
        </section>
      </div>
    </main>
  );
}
