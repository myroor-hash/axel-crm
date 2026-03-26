import { createBrowserSupabaseClient } from "@/lib/db/client";
import type {
  InvoiceSummary,
  LeadDetail,
  LeadEmailSummary,
  LeadQueueItem,
  LeadQueueView,
} from "@/features/leads/types";
import type { ImportedLeadRow } from "@/features/import/types";

export type DbActivity = {
  id: string;
  lead_id: string;
  user_id: string | null;
  actor_name: string | null;
  activity_type: string;
  action_label: string;
  note_text: string | null;
  created_at: string;
};

type LeadStatus = LeadQueueItem["status"];

type LeadRow = {
  id: string;
  external_ref: string | null;
  created_at: string | null;
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
  lead_sources?: {
    name?: string | null;
  } | null;
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
    lead_source_name:
      row.lead_sources && typeof row.lead_sources.name === "string"
        ? row.lead_sources.name
        : null,
    status: coerceLeadStatus(row.status),
    customer_flag: row.customer_flag ?? false,
    last_contacted_at: row.last_contacted_at,
    next_follow_up_at: row.next_follow_up_at,
    priority_note: row.priority_note,
  };
}

type CurrentCrmUser = {
  id: string;
  full_name: string;
};

async function fetchCurrentCrmUser(): Promise<CurrentCrmUser | null> {
  const currentCrmUserEndpoint = "/api/auth/current-crm-user" as string;

  const response = await fetch(currentCrmUserEndpoint, {
    method: "GET",
    cache: "no-store",
  });

  if (response.status === 401) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to load current CRM user.");
  }

  const payload = (await response.json().catch(() => null)) as
    | { id?: string; fullName?: string }
    | null;

  if (!payload?.id || typeof payload.id !== "string") {
    return null;
  }

  return {
    id: payload.id,
    full_name:
      typeof payload?.fullName === "string" && payload.fullName.trim()
        ? payload.fullName
        : "Unknown user",
  };
}

export async function fetchCurrentCrmActorName(): Promise<string | null> {
  const currentUser = await fetchCurrentCrmUser();
  return currentUser?.full_name ?? null;
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

export async function fetchLeadQueue(): Promise<LeadQueueView[]> {
  const queueEndpoint = "/api/leads/queue" as string;
  const response = await fetch(queueEndpoint, {
    method: "GET",
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | { rows?: LeadQueueView[]; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to load leads.");
  }

  return Array.isArray(payload?.rows) ? payload.rows : [];
}

export async function fetchLeadById(leadId: string): Promise<LeadDetail | null> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase
    .from("leads")
    .select(
      "id, external_ref, shop_name, contact_name, contact_first_name, contact_last_name, phone_number, email, address_line_1, address_line_2, address_line_3, town_city, county_region, postcode, lead_source_id, status, customer_flag, last_contacted_at, next_follow_up_at, priority_note, imported_at, is_active, lead_sources(name)"
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

  if (customerRef) {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        "id, invoice_ref, invoice_date, customer_name, customer_ref, total_amount, status, sent_status, description"
      )
      .eq("customer_ref", customerRef)
      .order("invoice_date", { ascending: false })
      .limit(10);

    if (error) {
      if (error.code === "42P01") {
        return [];
      }

      throw new Error(`Failed to load invoices: ${error.message}`);
    }

    if ((data ?? []).length > 0) {
      return (data ?? []).map((row) => ({
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
  }

  const { data, error } = await supabase
    .from("invoices")
    .select(
      "id, invoice_ref, invoice_date, customer_name, customer_ref, total_amount, status, sent_status, description"
    )
    .order("invoice_date", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      return [];
    }

    throw new Error(`Failed to load invoices: ${error.message}`);
  }

  return (data ?? [])
    .filter((row) =>
      businessNamesMatch(
        typeof row.customer_name === "string" ? row.customer_name : null,
        lead.shop_name
      )
    )
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

export async function fetchLeadEmails(leadId: string): Promise<LeadEmailSummary[]> {
  const supabase = createBrowserSupabaseClient();

  let { data, error } = await supabase
    .from("lead_emails")
    .select(
      "id, subject, recipient_email, sender_email, sent_by_name, attachment_name, sent_at, delivered_at, opened_at, clicked_at, status"
    )
    .eq("lead_id", leadId)
    .order("sent_at", { ascending: false })
    .limit(20);

  if (error && /sent_by_name/i.test(error.message)) {
    const fallback = await supabase
      .from("lead_emails")
      .select(
        "id, subject, recipient_email, sender_email, attachment_name, sent_at, delivered_at, opened_at, clicked_at, status"
      )
      .eq("lead_id", leadId)
      .order("sent_at", { ascending: false })
      .limit(20);

    data = fallback.data as typeof data;
    error = fallback.error;
  }

  if (error) {
    if (error.code === "42P01") {
      return [];
    }

    throw new Error(`Failed to load lead emails: ${error.message}`);
  }

  return ((data ?? []) as Array<Record<string, unknown>>).map((row) => ({
    id: String(row.id),
    subject: typeof row.subject === "string" ? row.subject : "Untitled email",
    recipient_email:
      typeof row.recipient_email === "string" ? row.recipient_email : "Unknown recipient",
    sender_email:
      typeof row.sender_email === "string" ? row.sender_email : "Unknown sender",
    sent_by_name:
      typeof row.sent_by_name === "string" ? row.sent_by_name : null,
    attachment_name:
      typeof row.attachment_name === "string" ? row.attachment_name : null,
    sent_at: typeof row.sent_at === "string" ? row.sent_at : new Date().toISOString(),
    delivered_at:
      typeof row.delivered_at === "string" ? row.delivered_at : null,
    opened_at: typeof row.opened_at === "string" ? row.opened_at : null,
    clicked_at: typeof row.clicked_at === "string" ? row.clicked_at : null,
    status: typeof row.status === "string" ? row.status : "sent",
  }));
}

export async function sendLeadEmail(args: {
  leadId: string;
  to: string;
  subject: string;
  body: string;
  attachmentIds: string[];
  attachmentName: string;
}): Promise<{
  senderName: string | null;
}> {
  const response = await fetch("/api/email/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  const payload = (await response.json().catch(() => null)) as
    | { error?: string; senderName?: string | null }
    | null;

  if (!response.ok) {
    throw new Error(payload?.error ?? "Failed to send email.");
  }

  return {
    senderName:
      typeof payload?.senderName === "string" && payload.senderName.trim()
        ? payload.senderName
        : null,
  };
}

export async function fetchCallsTodayCount(): Promise<number> {
  const supabase = createBrowserSupabaseClient();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);

  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);

  const { count, error } = await supabase
    .from("lead_activities")
    .select("id", { count: "exact", head: true })
    .eq("activity_type", "call")
    .gte("created_at", startOfDay.toISOString())
    .lt("created_at", endOfDay.toISOString());

  if (error) {
    throw new Error(`Failed to load today's call count: ${error.message}`);
  }

  return count ?? 0;
}

export async function fetchLeadActivities(leadId: string): Promise<DbActivity[]> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase
    .from("lead_activities")
    .select("id, lead_id, user_id, actor_name, activity_type, action_label, note_text, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load activities: ${error.message}`);
  }

  const activityRows = (data ?? []) as Array<Record<string, unknown>>;
  const userIds = [...new Set(
    activityRows
      .map((row) => (typeof row.user_id === "string" ? row.user_id : null))
      .filter((value): value is string => Boolean(value))
  )];

  const { data: users, error: usersError } = userIds.length
    ? await supabase.from("users").select("id, full_name").in("id", userIds)
    : { data: [] as Array<{ id: string; full_name: string }>, error: null };

  if (usersError) {
    throw new Error(`Failed to load activity users: ${usersError.message}`);
  }

  const userMap = new Map(
    (users ?? []).map((user) => [
      String(user.id),
      typeof user.full_name === "string" ? user.full_name : null,
    ])
  );

  return activityRows.map((row) => ({
    id: String(row.id),
    lead_id: String(row.lead_id),
    user_id: typeof row.user_id === "string" ? row.user_id : null,
    actor_name:
      typeof row.actor_name === "string" && row.actor_name.trim()
        ? row.actor_name
        : typeof row.user_id === "string"
          ? userMap.get(row.user_id) ?? null
          : null,
    activity_type:
      typeof row.activity_type === "string" ? row.activity_type : "note",
    action_label:
      typeof row.action_label === "string" ? row.action_label : "Unknown action",
    note_text: typeof row.note_text === "string" ? row.note_text : null,
    created_at:
      typeof row.created_at === "string" ? row.created_at : new Date().toISOString(),
  }));
}

export async function recordLeadActivity(args: {
  leadId: string;
  activityType: string;
  actionLabel: string;
  noteText?: string;
  actorName?: string | null;
  callOutcome?: string | null;
  previousStatus?: LeadStatus | null;
  newStatus?: LeadStatus | null;
  followUpSetFor?: string | null;
}): Promise<void> {
  const supabase = createBrowserSupabaseClient();
  const currentUser = await fetchCurrentCrmUser();
  const baseInsert = {
    lead_id: args.leadId,
    activity_type: args.activityType,
    actor_name: args.actorName ?? currentUser?.full_name ?? null,
    action_label: args.actionLabel,
    note_text: args.noteText ?? null,
    call_outcome: args.callOutcome ?? null,
    previous_status: args.previousStatus ?? null,
    new_status: args.newStatus ?? null,
    follow_up_set_for: args.followUpSetFor ?? null,
  };

  let { error } = await supabase.from("lead_activities").insert(
    currentUser
      ? {
          ...baseInsert,
          user_id: currentUser.id,
        }
      : baseInsert
  );

  if (error && currentUser && /user_id/i.test(error.message)) {
    const fallback = await supabase.from("lead_activities").insert(baseInsert);
    error = fallback.error;
  }

  if (error) {
    throw new Error(`Failed to record activity: ${error.message}`);
  }
}

export async function recordLeadNote(args: {
  leadId: string;
  noteText: string;
}): Promise<void> {
  const trimmedNote = args.noteText.trim();

  if (!trimmedNote) {
    throw new Error("Please enter a note before saving it.");
  }

  await recordLeadActivity({
    leadId: args.leadId,
    activityType: "note",
    actionLabel: "Note Added",
    noteText: trimmedNote,
  });
}

export async function scheduleLeadFollowUp(args: {
  leadId: string;
  followUpAt: string;
  previousStatus?: LeadStatus | null;
}): Promise<{
  status: LeadStatus;
  nextFollowUpAt: string;
}> {
  const response = await fetch("/api/leads/follow-up", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: string;
        status?: LeadStatus;
        nextFollowUpAt?: string;
      }
    | null;

  if (!response.ok || payload?.status !== "follow_up_required" || !payload?.nextFollowUpAt) {
    throw new Error(payload?.error ?? "Failed to save follow-up.");
  }

  return {
    status: payload.status,
    nextFollowUpAt: payload.nextFollowUpAt,
  };
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

export async function createManualLead(args: {
  leadKind: "prospect" | "customer";
  leadSourceId?: string | null;
  externalRef?: string | null;
  shopName: string;
  contactName?: string | null;
  phoneNumber: string;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressLine3?: string | null;
  townCity?: string | null;
  countyRegion?: string | null;
  postcode?: string | null;
  priorityNote?: string | null;
}): Promise<void> {
  const supabase = createBrowserSupabaseClient();

  const shopName = args.shopName.trim();
  const phoneNumber = args.phoneNumber.trim();

  if (!shopName) {
    throw new Error("Shop name is required.");
  }

  if (!phoneNumber) {
    throw new Error("Phone number is required.");
  }

  const externalRef = args.externalRef?.trim() || null;
  const normalizedPhone = normalizePhone(phoneNumber);

  const { data: existingRows, error: existingError } = await supabase
    .from("leads")
    .select("external_ref, phone_number");

  if (existingError) {
    throw new Error(`Failed to check for duplicates: ${existingError.message}`);
  }

  const duplicateExists = (existingRows ?? []).some((lead) => {
    const existingRef =
      typeof lead.external_ref === "string" ? lead.external_ref.trim().toLowerCase() : null;
    const existingPhone =
      typeof lead.phone_number === "string" ? normalizePhone(lead.phone_number) : "";

    return (
      (externalRef && existingRef === externalRef.toLowerCase()) ||
      (normalizedPhone && existingPhone === normalizedPhone)
    );
  });

  if (duplicateExists) {
    throw new Error("A lead with this customer number or phone number already exists.");
  }

  const { firstName, lastName } = splitContactName(args.contactName ?? undefined);
  const status: LeadStatus =
    args.leadKind === "customer" ? "customer" : "new";

  const { error } = await supabase.from("leads").insert({
    external_ref: externalRef,
    shop_name: shopName,
    contact_name: args.contactName?.trim() || null,
    contact_first_name: firstName,
    contact_last_name: lastName,
    phone_number: phoneNumber,
    email: args.email?.trim() || null,
    address_line_1: args.addressLine1?.trim() || null,
    address_line_2: args.addressLine2?.trim() || null,
    address_line_3: args.addressLine3?.trim() || null,
    town_city: args.townCity?.trim() || null,
    county_region: args.countyRegion?.trim() || null,
    postcode: args.postcode?.trim() || null,
    lead_source_id: args.leadSourceId ?? null,
    customer_flag: args.leadKind === "customer",
    status,
    priority_note: args.priorityNote?.trim() || null,
    imported_at: args.leadKind === "customer" ? new Date().toISOString() : null,
    is_active: true,
  });

  if (error) {
    throw new Error(`Failed to create lead: ${error.message}`);
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
  const response = await fetch("/api/leads/outcome", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(args),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        error?: string;
        status?: LeadStatus;
        lastContactedAt?: string;
        nextFollowUpAt?: string | null;
      }
    | null;

  if (!response.ok || !payload?.status || !payload?.lastContactedAt) {
    throw new Error(payload?.error ?? "Failed to update lead after call.");
  }

  return {
    status: payload.status,
    lastContactedAt: payload.lastContactedAt,
    nextFollowUpAt:
      typeof payload.nextFollowUpAt === "string" ? payload.nextFollowUpAt : null,
  };
}

export async function recordEmailSent(args: {
  leadId: string;
  actionLabel: string;
  noteText?: string;
  actorName?: string | null;
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
    actorName: args.actorName ?? null,
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
