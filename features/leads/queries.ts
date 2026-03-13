import { createBrowserSupabaseClient } from "@/lib/db/client";
import type {
  InvoiceSummary,
  LeadDetail,
  LeadQueueItem,
} from "@/features/leads/types";
import type { ImportedLeadRow } from "@/features/import/types";

export type DbActivity = {
  id: string;
  lead_id: string;
  activity_type: string;
  action_label: string;
  note_text: string | null;
  created_at: string;
};

type LeadStatus = LeadQueueItem["status"];

type LeadRow = {
  id: string;
  external_ref: string | null;
  shop_name: string;
  contact_name: string | null;
  contact_first_name: string | null;
  contact_last_name: string | null;
  phone_number: string;
  email: string | null;
  address_line_1: string | null;
  address_line_2: string | null;
  address_line_3: string | null;
  town_city: string | null;
  county_region: string | null;
  postcode: string | null;
  lead_source_id: string | null;
  status: string | null;
  last_outcome: string | null;
  customer_flag: boolean | null;
  last_contacted_at: string | null;
  next_follow_up_at: string | null;
  priority_note: string | null;
  imported_at: string | null;
  is_active: boolean | null;
};

type QueueLeadRow = Pick<
  LeadRow,
  | "external_ref"
  | "id"
  | "shop_name"
  | "contact_name"
  | "contact_first_name"
  | "contact_last_name"
  | "phone_number"
  | "postcode"
  | "town_city"
  | "status"
  | "last_outcome"
  | "last_contacted_at"
  | "next_follow_up_at"
  | "is_active"
>;

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

function normalizePhone(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, "").trim();
}

function splitContactName(name?: string) {
  const cleaned = String(name ?? "").trim();
  if (!cleaned) {
    return { firstName: null, lastName: null };
  }

  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: null };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(" "),
  };
}

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

function mapLeadDetail(row: LeadRow): LeadDetail {
  const fallbackNames = splitContactName(row.contact_name ?? undefined);

  return {
    id: row.id,
    customer_number: row.external_ref ?? null,
    external_ref: row.external_ref ?? undefined,
    shop_name: row.shop_name,
    contact_first_name: row.contact_first_name ?? fallbackNames.firstName,
    contact_last_name: row.contact_last_name ?? fallbackNames.lastName,
    phone_number: row.phone_number,
    email: row.email,
    town_city: row.town_city,
    county_region: row.county_region,
    postcode: row.postcode,
    address_line_1: row.address_line_1,
    address_line_2: row.address_line_2,
    address_line_3: row.address_line_3,
    lead_source_id: row.lead_source_id,
    status: coerceLeadStatus(row.status),
    customer_flag: row.customer_flag ?? false,
    last_contacted_at: row.last_contacted_at,
    next_follow_up_at: row.next_follow_up_at,
    priority_note: row.priority_note,
  };
}

function normalizeBusinessName(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\b(limited|ltd|llp|limited liability partnership|co|company)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
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

export async function fetchLeadQueue(): Promise<LeadQueueItem[]> {
  const supabase = createBrowserSupabaseClient();
  const now = new Date().toISOString();

  const [
    { data: leads, error: leadsError },
    { data: locks, error: locksError },
    { data: invoices, error: invoicesError },
  ] =
    await Promise.all([
      supabase
        .from("leads")
        .select(
          "id, external_ref, shop_name, contact_name, contact_first_name, contact_last_name, phone_number, postcode, town_city, status, last_outcome, last_contacted_at, next_follow_up_at, is_active"
        )
        .or("is_active.is.null,is_active.eq.true"),
      supabase
        .from("lead_locks")
        .select("lead_id, user_id")
        .eq("is_active", true)
        .is("released_at", null)
        .gt("expires_at", now),
      supabase.from("invoices").select("customer_name, customer_ref"),
    ]);

  if (leadsError) {
    throw new Error(`Failed to load leads: ${leadsError.message}`);
  }

  if (locksError) {
    throw new Error(`Failed to load lead locks: ${locksError.message}`);
  }

  if (invoicesError && invoicesError.code !== "42P01") {
    throw new Error(`Failed to load invoice summary: ${invoicesError.message}`);
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
    throw new Error(`Failed to load lead activity summary: ${activitiesError.message}`);
  }

  const activeLocks = (locks ?? []) as LockRow[];
  const userIds = [...new Set(activeLocks.map((lock) => lock.user_id))];
  const { data: users, error: usersError } = userIds.length
    ? await supabase.from("users").select("id, full_name").in("id", userIds)
    : { data: [] as UserRow[], error: null };

  if (usersError) {
    throw new Error(`Failed to load lock owners: ${usersError.message}`);
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

  const invoiceRows = (invoices ?? []) as QueueInvoiceRow[];

  return queueLeads.map((lead) => ({
    id: lead.id,
    customer_number: lead.external_ref ?? null,
    shop_name: lead.shop_name,
    town_city: lead.town_city ?? null,
    contact_name: buildContactName(lead),
    phone_number: lead.phone_number ?? null,
    postcode: lead.postcode ?? null,
    has_invoice_history: invoiceRows.some((invoice) => {
      const invoiceCustomerRef =
        typeof invoice.customer_ref === "string" ? invoice.customer_ref : null;
      const invoiceCustomerName =
        typeof invoice.customer_name === "string" ? invoice.customer_name : null;
      const leadCustomerRef =
        "external_ref" in lead && typeof lead.external_ref === "string"
          ? lead.external_ref
          : null;

      if (leadCustomerRef && invoiceCustomerRef === leadCustomerRef) {
        return true;
      }

      return businessNamesMatch(invoiceCustomerName, lead.shop_name);
    }),
    status: coerceLeadStatus(lead.status),
    last_outcome: lead.last_outcome ?? null,
    last_contacted_at: lead.last_contacted_at ?? null,
    last_activity_at: latestActivityMap.get(lead.id)?.created_at ?? null,
    last_activity_label: latestActivityMap.get(lead.id)?.action_label ?? null,
    next_follow_up_at: lead.next_follow_up_at ?? null,
    is_locked: lockMap.has(lead.id),
    locked_by_name: lockMap.get(lead.id) ?? null,
  }));
}

export async function fetchLeadById(leadId: string): Promise<LeadDetail | null> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, external_ref, shop_name, contact_name, contact_first_name, contact_last_name, phone_number, email, address_line_1, address_line_2, address_line_3, town_city, county_region, postcode, lead_source_id, status, customer_flag, last_contacted_at, next_follow_up_at, priority_note, imported_at, is_active"
    )
    .eq("id", leadId)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to load lead: ${error.message}`);
  }

  return mapLeadDetail(data as LeadRow);
}

export async function fetchLeadInvoices(
  lead: Pick<LeadDetail, "shop_name" | "customer_number" | "external_ref">
): Promise<InvoiceSummary[]> {
  const supabase = createBrowserSupabaseClient();
  const customerRef = lead.customer_number ?? lead.external_ref ?? null;

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_ref, invoice_date, customer_name, customer_ref, total_amount, status, sent_status, description"
    )
    .order("invoice_date", { ascending: false })
    .limit(25);

  if (error) {
    if (error.code === "42P01") {
      return [];
    }

    throw new Error(`Failed to load invoices: ${error.message}`);
  }

  return (data ?? [])
    .filter((row) => {
      const rowCustomerRef =
        typeof row.customer_ref === "string" ? row.customer_ref : null;
      const rowCustomerName =
        typeof row.customer_name === "string" ? row.customer_name : null;

      if (customerRef && rowCustomerRef === customerRef) {
        return true;
      }

      return businessNamesMatch(rowCustomerName, lead.shop_name);
    })
    .slice(0, 10)
    .map((row) => ({
      id: String(row.id),
      invoice_ref:
        typeof row.invoice_ref === "string" ? row.invoice_ref : "Unknown invoice",
      invoice_date:
        typeof row.invoice_date === "string" ? row.invoice_date : null,
      customer_name:
        typeof row.customer_name === "string" ? row.customer_name : null,
      total_amount:
        typeof row.total_amount === "string" ? row.total_amount : null,
      status: typeof row.status === "string" ? row.status : null,
      sent_status:
        typeof row.sent_status === "string" ? row.sent_status : null,
      description:
        typeof row.description === "string" ? row.description : null,
    }));
}

export async function fetchLeadActivities(leadId: string): Promise<DbActivity[]> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase
    .from("lead_activities")
    .select("id, lead_id, activity_type, action_label, note_text, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load activities: ${error.message}`);
  }

  return (data ?? []) as DbActivity[];
}

export async function recordLeadActivity(args: {
  leadId: string;
  activityType: string;
  actionLabel: string;
  noteText?: string;
  callOutcome?: string | null;
  previousStatus?: LeadStatus | null;
  newStatus?: LeadStatus | null;
  followUpSetFor?: string | null;
}): Promise<void> {
  const supabase = createBrowserSupabaseClient();

  const { error } = await supabase.from("lead_activities").insert({
    lead_id: args.leadId,
    activity_type: args.activityType,
    action_label: args.actionLabel,
    note_text: args.noteText ?? null,
    call_outcome: args.callOutcome ?? null,
    previous_status: args.previousStatus ?? null,
    new_status: args.newStatus ?? null,
    follow_up_set_for: args.followUpSetFor ?? null,
  });

  if (error) {
    throw new Error(`Failed to record activity: ${error.message}`);
  }
}

export async function importCustomers(args: {
  rows: ImportedLeadRow[];
  leadSourceId: string;
}): Promise<{ imported: number; skipped: number }> {
  const supabase = createBrowserSupabaseClient();

  const { data: existingRows, error: existingError } = await supabase
    .from("leads")
    .select("external_ref, phone_number");

  if (existingError) {
    throw new Error(`Failed to check duplicates: ${existingError.message}`);
  }

  const seenRefs = new Set(
    (existingRows ?? [])
      .map((lead) =>
        typeof lead.external_ref === "string"
          ? lead.external_ref.trim().toLowerCase()
          : null
      )
      .filter((value): value is string => Boolean(value))
  );
  const seenPhones = new Set(
    (existingRows ?? [])
      .map((lead) =>
        typeof lead.phone_number === "string" ? normalizePhone(lead.phone_number) : ""
      )
      .filter(Boolean)
  );

  let skipped = 0;
  const inserts: Array<Record<string, unknown>> = [];

  for (const row of args.rows) {
    const normalizedPhone = normalizePhone(row.phone_number);
    const externalRef = row.external_ref?.trim() || null;
    const normalizedRef = externalRef?.toLowerCase() ?? null;

    if (
      (normalizedRef && seenRefs.has(normalizedRef)) ||
      (normalizedPhone && seenPhones.has(normalizedPhone))
    ) {
      skipped += 1;
      continue;
    }

    const { firstName, lastName } = splitContactName(row.contact_name);

    inserts.push({
      external_ref: externalRef,
      shop_name: row.shop_name,
      contact_name: row.contact_name?.trim() || null,
      contact_first_name: firstName,
      contact_last_name: lastName,
      phone_number: row.phone_number,
      email: row.email ?? null,
      address_line_1: row.address_line_1 ?? null,
      address_line_2: row.address_line_2 ?? null,
      address_line_3: row.address_line_3 ?? null,
      town_city: row.town_city ?? null,
      county_region: row.county_region ?? null,
      postcode: row.postcode ?? null,
      lead_source_id: args.leadSourceId,
      customer_flag: true,
      status: "customer",
      priority_note: row.priority_note ?? null,
      imported_at: new Date().toISOString(),
      is_active: true,
    });

    if (normalizedRef) {
      seenRefs.add(normalizedRef);
    }
    if (normalizedPhone) {
      seenPhones.add(normalizedPhone);
    }
  }

  if (inserts.length > 0) {
    const { error: insertError } = await supabase.from("leads").insert(inserts);

    if (insertError) {
      throw new Error(`Failed to import customers: ${insertError.message}`);
    }
  }

  return { imported: inserts.length, skipped };
}

export async function clearImportedCustomers(): Promise<void> {
  const supabase = createBrowserSupabaseClient();

  const { error } = await supabase
    .from("leads")
    .delete()
    .not("imported_at", "is", null)
    .is("last_contacted_at", null)
    .eq("status", "customer");

  if (error) {
    throw new Error(`Failed to clear imported customers: ${error.message}`);
  }
}

function mapCallAction(action: string): {
  status: LeadStatus;
  callOutcome: string | null;
  followUpAt: string | null;
} {
  const now = new Date();

  switch (action) {
    case "No Answer":
      return {
        status: "attempted_contact",
        callOutcome: "no_answer",
        followUpAt: null,
      };
    case "Gatekeeper":
      return {
        status: "attempted_contact",
        callOutcome: "gatekeeper_only",
        followUpAt: null,
      };
    case "Spoke to Buyer":
      return {
        status: "spoke_to_contact",
        callOutcome: "spoke_to_buyer",
        followUpAt: null,
      };
    case "Send Info":
      return {
        status: "information_sent",
        callOutcome: "send_information",
        followUpAt: new Date(now.getTime() + 72 * 60 * 60 * 1000).toISOString(),
      };
    case "Ordered Broth Bites":
      return {
        status: "customer",
        callOutcome: "converted_to_customer",
        followUpAt: null,
      };
    default:
      return {
        status: "attempted_contact",
        callOutcome: null,
        followUpAt: null,
      };
  }
}

export async function recordCallOutcome(args: {
  leadId: string;
  actionLabel: string;
  noteText?: string;
  previousStatus?: LeadStatus | null;
  manualFollowUpAt?: string | null;
}): Promise<{
  status: LeadStatus;
  lastContactedAt: string;
  nextFollowUpAt: string | null;
}> {
  const supabase = createBrowserSupabaseClient();
  const now = new Date().toISOString();
  const mapped = mapCallAction(args.actionLabel);
  const nextFollowUpAt = args.manualFollowUpAt ?? mapped.followUpAt;
  const status =
    args.manualFollowUpAt && mapped.status !== "customer" && mapped.status !== "information_sent"
      ? "follow_up_required"
      : mapped.status;

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      status,
      last_contacted_at: now,
      next_follow_up_at: nextFollowUpAt,
      last_outcome: mapped.callOutcome,
    })
    .eq("id", args.leadId);

  if (updateError) {
    throw new Error(`Failed to update lead after call: ${updateError.message}`);
  }

  await recordLeadActivity({
    leadId: args.leadId,
    activityType: "call",
    actionLabel: args.actionLabel,
    noteText: args.noteText,
    callOutcome: mapped.callOutcome,
    previousStatus: args.previousStatus ?? null,
    newStatus: status,
    followUpSetFor: nextFollowUpAt,
  });

  return {
    status,
    lastContactedAt: now,
    nextFollowUpAt,
  };
}

export async function recordEmailSent(args: {
  leadId: string;
  actionLabel: string;
  noteText?: string;
  previousStatus?: LeadStatus | null;
}): Promise<{
  status: LeadStatus;
  nextFollowUpAt: string | null;
}> {
  const supabase = createBrowserSupabaseClient();
  const followUpAt = new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString();
  const status: LeadStatus = "information_sent";

  const { error: updateError } = await supabase
    .from("leads")
    .update({
      status,
      next_follow_up_at: followUpAt,
      last_outcome: "send_information",
    })
    .eq("id", args.leadId);

  if (updateError) {
    throw new Error(`Failed to update lead after email: ${updateError.message}`);
  }

  await recordLeadActivity({
    leadId: args.leadId,
    activityType: "email_sent",
    actionLabel: args.actionLabel,
    noteText: args.noteText,
    callOutcome: "send_information",
    previousStatus: args.previousStatus ?? null,
    newStatus: status,
    followUpSetFor: followUpAt,
  });

  return {
    status,
    nextFollowUpAt: followUpAt,
  };
}
