import { NextResponse } from "next/server";
import { getCurrentCrmUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/db/admin";
import type { LeadQueueView, LeadStatus } from "@/features/leads/types";

type QueueLeadRow = {
  id: string;
  external_ref: string | null;
  created_at: string | null;
  shop_name: string;
  contact_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  phone_number: string | null;
  postcode: string | null;
  town_city: string | null;
  status: string | null;
  last_outcome: string | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  is_active: boolean | null;
};

type LockRow = {
  lead_id: string;
  user_id: string;
};

type QueueActivityRow = {
  lead_id: string;
  action_label: string;
  created_at: string;
};

type UserRow = {
  id: string;
  full_name: string;
};

type QueueInvoiceRow = {
  customer_name: string | null;
  customer_ref: string | null;
};

type QueueEmailRow = {
  lead_id: string;
  clicked_at: string | null;
};

const INVOICE_PAGE_SIZE = 1000;
const UK_TIME_ZONE = "Europe/London";

function buildContactName(lead: {
  contact_name?: string | null;
  contact_first_name?: string | null;
  contact_last_name?: string | null;
}) {
  if (lead.contact_name) return lead.contact_name;
  return [lead.contact_first_name, lead.contact_last_name]
    .filter(Boolean)
    .join(" ") || null;
}

function coerceLeadStatus(value: string | null | undefined): LeadStatus {
  switch (value) {
    case "new":
    case "attempted_contact":
    case "spoke_to_contact":
    case "follow_up_required":
    case "information_sent":
    case "sample_sent":
    case "customer":
    case "dead_lead":
      return value;
    default:
      return "new";
  }
}

function normalizeBusinessName(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/\b(limited|ltd|llp|limited liability partnership|co|company|inc|uk)\b/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, "");
}

function businessNamesMatch(left: string | null | undefined, right: string | null | undefined) {
  const normalizedLeft = normalizeBusinessName(left);
  const normalizedRight = normalizeBusinessName(right);

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  if (normalizedLeft === normalizedRight) {
    return true;
  }

  const shorterLength = Math.min(normalizedLeft.length, normalizedRight.length);
  if (shorterLength < 6) {
    return false;
  }

  return (
    normalizedLeft.includes(normalizedRight) ||
    normalizedRight.includes(normalizedLeft)
  );
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

async function fetchAllInvoiceRows(supabase: ReturnType<typeof createAdminSupabaseClient>) {
  const rows: QueueInvoiceRow[] = [];
  let from = 0;

  while (true) {
    const to = from + INVOICE_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("invoices")
      .select("customer_name, customer_ref")
      .range(from, to);

    if (error) {
      if (error.code === "42P01") {
        return [];
      }

      throw error;
    }

    const batch = (data ?? []) as QueueInvoiceRow[];
    rows.push(...batch);

    if (batch.length < INVOICE_PAGE_SIZE) {
      break;
    }

    from += INVOICE_PAGE_SIZE;
  }

  return rows;
}

export async function GET() {
  const crmUser = await getCurrentCrmUser();

  if (!crmUser || !crmUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const todayKey = getLondonDateKey(now);

  const [
    { data: leads, error: leadsError },
    { data: locks, error: locksError },
    { data: leadEmails, error: leadEmailsError },
  ] = await Promise.all([
    supabase
      .from("leads")
      .select(
        "id, external_ref, created_at, shop_name, contact_name, contact_first_name, contact_last_name, phone_number, postcode, town_city, status, last_outcome, last_contacted_at, next_follow_up_at, is_active"
      )
      .or("is_active.is.null,is_active.eq.true"),
    supabase
      .from("lead_locks")
      .select("lead_id, user_id")
      .eq("is_active", true)
      .is("released_at", null)
      .gt("expires_at", nowIso),
    supabase
      .from("lead_emails")
      .select("lead_id, clicked_at")
      .not("clicked_at", "is", null)
      .order("clicked_at", { ascending: false }),
  ]);

  if (leadsError) {
    return NextResponse.json(
      { error: `Failed to load leads: ${leadsError.message}` },
      { status: 500 }
    );
  }

  if (locksError) {
    return NextResponse.json(
      { error: `Failed to load lead locks: ${locksError.message}` },
      { status: 500 }
    );
  }

  if (leadEmailsError && leadEmailsError.code !== "42P01") {
    return NextResponse.json(
      { error: `Failed to load email engagement summary: ${leadEmailsError.message}` },
      { status: 500 }
    );
  }

  let invoiceRows: QueueInvoiceRow[] = [];
  try {
    invoiceRows = await fetchAllInvoiceRows(supabase);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to load invoice summary.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const queueLeads = (leads ?? []) as QueueLeadRow[];
  const leadIds = queueLeads.map((lead) => lead.id);
  const { data: activities, error: activitiesError } = leadIds.length
    ? await supabase
        .from("lead_activities")
        .select("lead_id, action_label, created_at")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false })
    : { data: [] as QueueActivityRow[], error: null };

  if (activitiesError) {
    return NextResponse.json(
      { error: `Failed to load lead activity summary: ${activitiesError.message}` },
      { status: 500 }
    );
  }

  const activeLocks = (locks ?? []) as LockRow[];
  const userIds = [...new Set(activeLocks.map((lock) => lock.user_id))];
  const { data: users, error: usersError } = userIds.length
    ? await supabase.from("users").select("id, full_name").in("id", userIds)
    : { data: [] as UserRow[], error: null };

  if (usersError) {
    return NextResponse.json(
      { error: `Failed to load lock owners: ${usersError.message}` },
      { status: 500 }
    );
  }

  const userMap = new Map((users ?? []).map((user) => [user.id, user.full_name]));
  const lockMap = new Map(
    activeLocks.map((lock) => [
      String(lock.lead_id),
      (() => {
        const fullName = userMap.get(String(lock.user_id));
        return typeof fullName === "string" ? fullName : null;
      })(),
    ])
  );

  const latestActivityMap = new Map<string, QueueActivityRow>();
  for (const activity of (activities ?? []) as QueueActivityRow[]) {
    if (!latestActivityMap.has(activity.lead_id)) {
      latestActivityMap.set(activity.lead_id, activity);
    }
  }

  const invoiceRefSet = new Set(
    invoiceRows
      .map((invoice) =>
        typeof invoice.customer_ref === "string"
          ? invoice.customer_ref.trim().toLowerCase()
          : null
      )
      .filter((value): value is string => Boolean(value))
  );
  const invoiceNameSet = new Set(
    invoiceRows
      .map((invoice) =>
        typeof invoice.customer_name === "string"
          ? normalizeBusinessName(invoice.customer_name)
          : null
      )
      .filter((value): value is string => Boolean(value))
  );

  const latestClickMap = new Map<string, string>();
  for (const email of (leadEmails ?? []) as QueueEmailRow[]) {
    if (email.clicked_at && !latestClickMap.has(email.lead_id)) {
      latestClickMap.set(email.lead_id, email.clicked_at);
    }
  }

  const rows: LeadQueueView[] = queueLeads
    .map((lead) => {
      const lastActivityAt = latestActivityMap.get(lead.id)?.created_at ?? null;
      const lastActivityLabel = latestActivityMap.get(lead.id)?.action_label ?? null;
      const followUpAt = lead.next_follow_up_at ?? null;
      const followUpDateKey = getLondonDateKey(followUpAt);
      const hasContactHistory = Boolean(
        lead.last_contacted_at || lead.last_outcome || lastActivityAt
      );
      const normalizedLeadName = normalizeBusinessName(lead.shop_name);
      const leadCustomerRef =
        typeof lead.external_ref === "string"
          ? lead.external_ref.trim().toLowerCase()
          : null;
      const hasInvoiceHistory =
        Boolean(leadCustomerRef && invoiceRefSet.has(leadCustomerRef)) ||
        Boolean(normalizedLeadName && invoiceNameSet.has(normalizedLeadName)) ||
        invoiceRows.some((invoice) =>
          businessNamesMatch(
            typeof invoice.customer_name === "string" ? invoice.customer_name : null,
            lead.shop_name
          )
        );
      const followUpAvailable =
        Boolean(followUpDateKey && todayKey && followUpDateKey <= todayKey);
      const followUpDue =
        Boolean(followUpAt) && new Date(followUpAt as string).getTime() <= now.getTime();

      let statusBadge = "Not Contacted";
      if (followUpAvailable) {
        if (followUpDue) {
          statusBadge = "Follow Up Due";
        } else if (followUpDateKey === todayKey) {
          statusBadge = "Follow Up Today";
        } else {
          statusBadge = "Overdue Follow Up";
        }
      } else if (followUpAt) {
        statusBadge = "Follow Up Booked";
      } else if (hasContactHistory) {
        statusBadge = "Contacted";
      }

      let queueBucket: LeadQueueView["queue_bucket"] = "other";
      if (followUpAvailable) {
        queueBucket = "follow_up";
      } else if (hasInvoiceHistory) {
        queueBucket = "existing";
      } else {
        queueBucket = "new_leads";
      }

      return {
        id: lead.id,
        customer_number: lead.external_ref ?? null,
        created_at: lead.created_at ?? null,
        shop_name: lead.shop_name,
        town_city: lead.town_city ?? null,
        contact_name: buildContactName(lead),
        phone_number: lead.phone_number ?? null,
        postcode: lead.postcode ?? null,
        has_invoice_history: hasInvoiceHistory,
        status: coerceLeadStatus(lead.status),
        last_outcome: lead.last_outcome ?? null,
        last_contacted_at: lead.last_contacted_at ?? null,
        last_activity_at: lastActivityAt,
        last_activity_label: lastActivityLabel,
        next_follow_up_at: followUpAt,
        recent_email_clicked_at: latestClickMap.get(lead.id) ?? null,
        is_locked: lockMap.has(lead.id),
        locked_by_name: lockMap.get(lead.id) ?? null,
        computed_has_contact_history: hasContactHistory,
        computed_follow_up_at: followUpAt,
        computed_follow_up_available: followUpAvailable,
        computed_follow_up_due: followUpDue,
        computed_status_badge: statusBadge,
        queue_bucket: queueBucket,
      };
    })
    .sort((a, b) => {
      if (a.queue_bucket === "follow_up" && b.queue_bucket === "follow_up") {
        const aTime = a.computed_follow_up_at
          ? new Date(a.computed_follow_up_at).getTime()
          : Number.POSITIVE_INFINITY;
        const bTime = b.computed_follow_up_at
          ? new Date(b.computed_follow_up_at).getTime()
          : Number.POSITIVE_INFINITY;
        return aTime - bTime;
      }

      if (a.queue_bucket === "existing" && b.queue_bucket === "existing") {
        const aTime = a.last_contacted_at ? new Date(a.last_contacted_at).getTime() : 0;
        const bTime = b.last_contacted_at ? new Date(b.last_contacted_at).getTime() : 0;
        if (aTime !== bTime) {
          return aTime - bTime;
        }
      }

      if (a.queue_bucket === "new_leads" && b.queue_bucket === "new_leads") {
        const aTime = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bTime = b.created_at ? new Date(b.created_at).getTime() : 0;
        if (aTime !== bTime) {
          return bTime - aTime;
        }
      }

      return a.shop_name.localeCompare(b.shop_name, "en-GB");
    });

  return NextResponse.json({ rows });
}
