import { NextResponse } from "next/server";
import { getCurrentCrmUser } from "@/lib/auth/session";

export async function GET() {
  const crmUser = await getCurrentCrmUser();

  if (!crmUser || !crmUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return NextResponse.json({
    id: crmUser.id,
    fullName: crmUser.full_name,
  });
}
