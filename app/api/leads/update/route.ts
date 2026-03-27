import { NextResponse } from "next/server";
import { getCurrentCrmUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/db/admin";

type UpdateLeadPayload = {
  leadId?: string;
  shopName?: string;
  contactFirstName?: string | null;
  contactLastName?: string | null;
  phoneNumber?: string;
  email?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  addressLine3?: string | null;
  townCity?: string | null;
  countyRegion?: string | null;
  postcode?: string | null;
};

export async function POST(request: Request) {
  const crmUser = await getCurrentCrmUser();

  if (!crmUser || !crmUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as UpdateLeadPayload | null;
  const leadId = typeof payload?.leadId === "string" ? payload.leadId : null;
  const shopName = typeof payload?.shopName === "string" ? payload.shopName.trim() : "";
  const phoneNumber =
    typeof payload?.phoneNumber === "string" ? payload.phoneNumber.trim() : "";

  if (!leadId || !shopName || !phoneNumber) {
    return NextResponse.json(
      { error: "Shop name and phone number are required." },
      { status: 400 }
    );
  }

  const update = {
    shop_name: shopName,
    contact_first_name:
      typeof payload?.contactFirstName === "string" && payload.contactFirstName.trim()
        ? payload.contactFirstName.trim()
        : null,
    contact_last_name:
      typeof payload?.contactLastName === "string" && payload.contactLastName.trim()
        ? payload.contactLastName.trim()
        : null,
    phone_number: phoneNumber,
    email:
      typeof payload?.email === "string" && payload.email.trim()
        ? payload.email.trim()
        : null,
    address_line_1:
      typeof payload?.addressLine1 === "string" && payload.addressLine1.trim()
        ? payload.addressLine1.trim()
        : null,
    address_line_2:
      typeof payload?.addressLine2 === "string" && payload.addressLine2.trim()
        ? payload.addressLine2.trim()
        : null,
    address_line_3:
      typeof payload?.addressLine3 === "string" && payload.addressLine3.trim()
        ? payload.addressLine3.trim()
        : null,
    town_city:
      typeof payload?.townCity === "string" && payload.townCity.trim()
        ? payload.townCity.trim()
        : null,
    county_region:
      typeof payload?.countyRegion === "string" && payload.countyRegion.trim()
        ? payload.countyRegion.trim()
        : null,
    postcode:
      typeof payload?.postcode === "string" && payload.postcode.trim()
        ? payload.postcode.trim()
        : null,
  };

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("leads").update(update).eq("id", leadId);

  if (error) {
    return NextResponse.json(
      { error: `Failed to update lead details: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
