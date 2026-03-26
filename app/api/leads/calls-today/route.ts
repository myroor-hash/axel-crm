import { NextResponse } from "next/server";
import { getCurrentCrmUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/db/admin";

const UK_TIME_ZONE = "Europe/London";

function getTimeZoneOffsetMinutes(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    timeZoneName: "shortOffset",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(date);

  const offsetLabel =
    parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT";

  if (offsetLabel === "GMT") {
    return 0;
  }

  const match = offsetLabel.match(/^GMT([+-])(\d{1,2})(?::?(\d{2}))?$/);
  if (!match) {
    return 0;
  }

  const [, sign, hoursText, minutesText] = match;
  const hours = Number(hoursText);
  const minutes = Number(minutesText ?? "0");
  const total = hours * 60 + minutes;

  return sign === "-" ? -total : total;
}

function getDatePartsInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);

  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

function getUtcStartOfDayForTimeZone(date: Date, timeZone: string) {
  const { year, month, day } = getDatePartsInTimeZone(date, timeZone);
  const utcMidnightGuess = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const offsetMinutes = getTimeZoneOffsetMinutes(utcMidnightGuess, timeZone);

  return new Date(utcMidnightGuess.getTime() - offsetMinutes * 60 * 1000);
}

export async function GET() {
  const crmUser = await getCurrentCrmUser();

  if (!crmUser || !crmUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const startOfDay = getUtcStartOfDayForTimeZone(now, UK_TIME_ZONE);
  const tomorrow = new Date(startOfDay);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  const supabase = createAdminSupabaseClient();
  const { count, error } = await supabase
    .from("lead_activities")
    .select("id", { count: "exact", head: true })
    .eq("activity_type", "call")
    .gte("created_at", startOfDay.toISOString())
    .lt("created_at", tomorrow.toISOString());

  if (error) {
    return NextResponse.json(
      { error: `Failed to load today's call count: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    count: count ?? 0,
    timeZone: UK_TIME_ZONE,
  });
}
