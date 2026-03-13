"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { LeadList } from "@/components/leads/lead-list";
import { LeadDetailPanel } from "@/components/leads/lead-detail-panel";
import { NextLeadButton } from "@/components/leads/next-lead-button";
import { EmailComposePanel } from "@/components/leads/email-compose-panel";
import {
  fetchLeadActivities,
  fetchLeadById,
  fetchLeadInvoices,
  fetchLeadQueue,
  recordCallOutcome,
  recordEmailSent,
  type DbActivity,
} from "@/features/leads/queries";
import { getLeadReadOnlyState } from "@/features/locks/queries";
import { fetchAttachmentOptions } from "@/features/attachments/queries";
import { LogoutButton } from "@/components/auth/logout-button";
import type {
  InvoiceSummary,
  LeadDetail,
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

export default function ProtectedHomePage() {
  const [, setQueueClock] = useState(() => Date.now());
  const [baseQueue, setBaseQueue] = useState<LeadQueueItem[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedLead, setSelectedLead] = useState<LeadDetail | null>(null);
  const [readOnlyState, setReadOnlyState] = useState<LeadReadOnlyState | null>(null);
  const [invoiceMap, setInvoiceMap] = useState<Record<string, InvoiceSummary[]>>({});
  const [activityMap, setActivityMap] = useState<Record<string, Activity[]>>({});
  const [lastActionMap, setLastActionMap] = useState<Record<string, string | null>>({});
  const [contactStateMap, setContactStateMap] = useState<Record<string, ContactState>>({});
  const [showUnfinishedWarning, setShowUnfinishedWarning] = useState(false);
  const [panelMode, setPanelMode] = useState<PanelMode>("lead");
  const [attachments, setAttachments] = useState<AttachmentOption[]>([]);
  const [searchTerm, setSearchTerm] = useState("");

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

    loadQueue();
    loadAttachments();
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

      let statusBadge = "Not Contacted";
      if (contactState?.statusLabel) {
        statusBadge = contactState.statusLabel;
      } else if (followUpDue) {
        statusBadge = "Follow Up Due";
      } else if (followUpAt) {
        statusBadge = "Follow Up Scheduled";
      } else if (hasContactHistory) {
        statusBadge = "Contacted";
      }

      const neverContacted = !hasContactHistory;

      let priority = 3;
      if (followUpDue) priority = 1;
      else if (neverContacted) priority = 2;

      return {
        ...lead,
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

        if (a.computed_priority === 1) {
          const aTime = a.computed_follow_up_at ? new Date(a.computed_follow_up_at).getTime() : Infinity;
          const bTime = b.computed_follow_up_at ? new Date(b.computed_follow_up_at).getTime() : Infinity;
          return aTime - bTime;
        }

        if (a.computed_priority === 2) {
          return a.shop_name.localeCompare(b.shop_name);
        }

        const aTime = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
        const bTime = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
        return aTime - bTime;
      });
  }, [baseQueue, contactStateMap]);

  const filteredQueue = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return queue;

    return queue.filter((lead) => {
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
  }, [queue, searchTerm]);

  const visibleQueue = useMemo(() => filteredQueue.slice(0, 20), [filteredQueue]);

  const nextAvailableLeadId = useMemo(() => {
    if (queue.length === 0) return null;

    const unlockedQueue = queue.filter((lead) => !lead.is_locked);
    if (unlockedQueue.length === 0) return selectedLeadId;

    if (!selectedLeadId) return unlockedQueue[0].id;

    const currentIndex = queue.findIndex((lead) => lead.id === selectedLeadId);
    if (currentIndex === -1) return unlockedQueue[0].id;

    for (let i = currentIndex + 1; i < queue.length; i += 1) {
      if (!queue[i].is_locked) return queue[i].id;
    }

    for (let i = 0; i < currentIndex; i += 1) {
      if (!queue[i].is_locked) return queue[i].id;
    }

    return selectedLeadId;
  }, [queue, selectedLeadId]);

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

    const attachment = attachments.find((file) => file.id === payload.attachmentId);
    const action = `Email Sent${attachment ? ` — ${attachment.fileName}` : ""}`;

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
  const selectedLeadLastAction = selectedLeadId ? lastActionMap[selectedLeadId] ?? null : null;

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <PageHeader
          title="Call Queue"
          description="Follow-ups first, then untouched leads, then oldest contacted leads."
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <NextLeadButton onClick={handleCallNextLead} />
              <LogoutButton />
            </div>
          }
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
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

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Calls Today" value="0" />
          <StatCard title="Follow-ups Due" value={String(queue.filter((lead) => lead.computed_priority === 1).length)} />
          <StatCard title="New Leads" value={String(queue.filter((lead) => lead.computed_priority === 2).length)} />
          <StatCard title="Broth Bite Orders" value={String(queue.filter((lead) => lead.last_outcome === "converted_to_customer").length)} />
        </section>

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
              lastAction={selectedLeadLastAction}
              onOpenPreparedEmail={handleOpenPreparedEmail}
            />
          )}
        </section>
      </div>
    </main>
  );
}
