import Papa from "papaparse";
import * as XLSX from "xlsx";
import type { ImportedLeadRow } from "./types";

export async function parseLeadFile(file: File): Promise<ImportedLeadRow[]> {
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".csv")) {
    const text = await file.text();

    const parsed = Papa.parse(text, {
      header: true,
      skipEmptyLines: true,
    });

    const rows = (parsed.data ?? []) as Record<string, unknown>[];

    return rows
      .map(normalizeRow)
      .filter((row) => row.shop_name && row.phone_number);
  }

  if (fileName.endsWith(".xlsx") || fileName.endsWith(".xls")) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { raw: false });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      raw: false,
      defval: "",
    });

    return json
      .map(normalizeRow)
      .filter((row) => row.shop_name && row.phone_number);
  }

  throw new Error("Unsupported file type");
}

function asCleanString(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;

  const cleaned = String(value).trim();

  if (!cleaned) return undefined;
  if (cleaned.toLowerCase() === "nan") return undefined;

  return cleaned;
}

function normalizePhone(value: unknown): string | undefined {
  const cleaned = asCleanString(value);
  if (!cleaned) return undefined;

  // Keep digits and leading zeroes exactly as text where possible
  const digitsOnly = cleaned.replace(/[^\d+]/g, "");

  if (!digitsOnly) return undefined;

  // If the original value lost its leading zero because it came in as a number,
  // and it looks like a UK landline/mobile length, restore a leading zero.
  if (!digitsOnly.startsWith("0") && /^\d{10,11}$/.test(digitsOnly)) {
    return `0${digitsOnly}`;
  }

  return digitsOnly;
}

function normalizeRow(row: Record<string, unknown>): ImportedLeadRow {
  const shopName =
    asCleanString(row["Business Name"]) ||
    asCleanString(row["Name"]) ||
    "";

  return {
    external_ref: asCleanString(row["Ref"]),
    shop_name: shopName,
    business_name: asCleanString(row["Business Name"]),
    contact_name: asCleanString(row["Contact Name"]),
    phone_number: normalizePhone(row["Telephone Number"]) || "",
    email: asCleanString(row["Email"]),
    town_city: asCleanString(row["Town/City"]),
    county_region: asCleanString(row["County"]),
    postcode: asCleanString(row["Postcode"]),
    address_line_1: asCleanString(row["AddressLine1"]),
    address_line_2: asCleanString(row["AddressLine2"]),
    address_line_3: asCleanString(row["AddressLine3"]),
    priority_note: undefined,
  };
}
