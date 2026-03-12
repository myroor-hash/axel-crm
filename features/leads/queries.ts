import type { LeadDetail, LeadQueueItem } from "@/features/leads/types";
import type { ImportedLeadRow } from "@/features/import/types";

const STORAGE_KEY = "axel-elixir-imported-customers";

const seedQueue: LeadQueueItem[] = [
  {
    id: "lead-1",
    shop_name: "Axel Health Store",
    town_city: "Manchester",
    contact_name: "Sarah Mitchell",
    phone_number: "0161 555 1000",
    postcode: "M1 1AA",
    status: "new",
    last_contacted_at: null,
    is_locked: false,
    locked_by_name: null,
  },
  {
    id: "lead-2",
    shop_name: "Urban Roots",
    town_city: "Sheffield",
    contact_name: "Tom Wilkes",
    phone_number: "0114 555 2211",
    postcode: "S1 2AB",
    status: "follow_up_required",
    last_contacted_at: "2026-03-10T10:00:00.000Z",
    is_locked: false,
    locked_by_name: null,
  },
  {
    id: "lead-3",
    shop_name: "Green Leaf Grocers",
    town_city: "Leeds",
    contact_name: "Mike Turner",
    phone_number: "0113 555 9988",
    postcode: "LS1 4ZZ",
    status: "information_sent",
    last_contacted_at: "2026-03-12T09:00:00.000Z",
    is_locked: true,
    locked_by_name: "Dan",
  },
];

const seedDetails: Record<string, LeadDetail> = {
  "lead-1": {
    id: "lead-1",
    external_ref: undefined,
    shop_name: "Axel Health Store",
    contact_first_name: "Sarah",
    contact_last_name: "Mitchell",
    phone_number: "0161 555 1000",
    email: "sarah@example.com",
    town_city: "Manchester",
    county_region: "Greater Manchester",
    postcode: "M1 1AA",
    address_line_1: null,
    address_line_2: null,
    address_line_3: null,
    lead_source_id: null,
    status: "new",
    customer_flag: false,
    last_contacted_at: null,
    next_follow_up_at: null,
    priority_note: "Ask for the buyer on weekdays.",
  },
  "lead-2": {
    id: "lead-2",
    external_ref: undefined,
    shop_name: "Urban Roots",
    contact_first_name: "Tom",
    contact_last_name: "Wilkes",
    phone_number: "0114 555 2211",
    email: "tom@example.com",
    town_city: "Sheffield",
    county_region: "South Yorkshire",
    postcode: "S1 2AB",
    address_line_1: null,
    address_line_2: null,
    address_line_3: null,
    lead_source_id: null,
    status: "follow_up_required",
    customer_flag: false,
    last_contacted_at: "2026-03-10T10:00:00.000Z",
    next_follow_up_at: "2026-03-13T10:00:00.000Z",
    priority_note: "Asked for a brochure.",
  },
  "lead-3": {
    id: "lead-3",
    external_ref: undefined,
    shop_name: "Green Leaf Grocers",
    contact_first_name: "Mike",
    contact_last_name: "Turner",
    phone_number: "0113 555 9988",
    email: "mike@example.com",
    town_city: "Leeds",
    county_region: "West Yorkshire",
    postcode: "LS1 4ZZ",
    address_line_1: null,
    address_line_2: null,
    address_line_3: null,
    lead_source_id: null,
    status: "information_sent",
    customer_flag: false,
    last_contacted_at: "2026-03-12T09:00:00.000Z",
    next_follow_up_at: "2026-03-19T09:00:00.000Z",
    priority_note: "Dan is already working this one.",
  },
};

type StoredCustomer = LeadDetail;

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

function getStoredCustomers(): StoredCustomer[] {
  if (typeof window === "undefined") return [];

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoredCustomer[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function setStoredCustomers(customers: StoredCustomer[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(customers));
}

function buildContactName(lead: LeadDetail): string | null {
  return [lead.contact_first_name, lead.contact_last_name].filter(Boolean).join(" ") || null;
}

export async function fetchLeadQueue(): Promise<LeadQueueItem[]> {
  const stored = getStoredCustomers();

  const storedQueue: LeadQueueItem[] = stored.map((customer) => ({
    id: customer.id,
    shop_name: customer.shop_name,
    town_city: customer.town_city ?? null,
    contact_name: buildContactName(customer),
    phone_number: customer.phone_number ?? null,
    postcode: customer.postcode ?? null,
    status: customer.status,
    last_contacted_at: customer.last_contacted_at,
    is_locked: false,
    locked_by_name: null,
  }));

  return [...storedQueue, ...seedQueue];
}

export async function fetchLeadById(leadId: string): Promise<LeadDetail | null> {
  const stored = getStoredCustomers();
  const foundStored = stored.find((lead) => lead.id === leadId);
  if (foundStored) return foundStored;

  return seedDetails[leadId] ?? null;
}

export async function importCustomers(args: {
  rows: ImportedLeadRow[];
  leadSourceId: string;
}): Promise<{ imported: number; skipped: number }> {
  const existing = getStoredCustomers();
  let imported = 0;
  let skipped = 0;

  const working = [...existing];

  for (const row of args.rows) {
    const normalizedPhone = normalizePhone(row.phone_number);
    const externalRef = row.external_ref?.trim();

    const duplicateInStored = working.some((lead) => {
      const sameRef =
        externalRef &&
        lead.external_ref &&
        lead.external_ref.trim().toLowerCase() === externalRef.toLowerCase();

      const samePhone =
        normalizedPhone &&
        normalizePhone(lead.phone_number) === normalizedPhone;

      return Boolean(sameRef || samePhone);
    });

    const duplicateInSeed = Object.values(seedDetails).some((lead) => {
      const sameRef =
        externalRef &&
        lead.external_ref &&
        lead.external_ref.trim().toLowerCase() === externalRef.toLowerCase();

      const samePhone =
        normalizedPhone &&
        normalizePhone(lead.phone_number) === normalizedPhone;

      return Boolean(sameRef || samePhone);
    });

    if (duplicateInStored || duplicateInSeed) {
      skipped += 1;
      continue;
    }

    const id = `imported-${Date.now()}-${imported + 1}`;
    const { firstName, lastName } = splitContactName(row.contact_name);

    const detail: LeadDetail = {
      id,
      external_ref: externalRef,
      shop_name: row.shop_name,
      contact_first_name: firstName,
      contact_last_name: lastName,
      phone_number: row.phone_number,
      email: row.email ?? null,
      town_city: row.town_city ?? null,
      county_region: row.county_region ?? null,
      postcode: row.postcode ?? null,
      address_line_1: row.address_line_1 ?? null,
      address_line_2: row.address_line_2 ?? null,
      address_line_3: row.address_line_3 ?? null,
      lead_source_id: args.leadSourceId,
      status: "customer",
      customer_flag: true,
      last_contacted_at: null,
      next_follow_up_at: null,
      priority_note: row.priority_note ?? null,
    };

    working.push(detail);
    imported += 1;
  }

  setStoredCustomers(working);

  return { imported, skipped };
}

export async function clearImportedCustomers(): Promise<void> {
  setStoredCustomers([]);
}

