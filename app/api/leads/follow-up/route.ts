import { NextResponse } from "next/server";
import { getCurrentCrmUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/db/admin";
import type { LeadStatus } from "@/features/leads/types";

type FollowUpPayload = {
  leadId?: string;
  followUpAt?: string;
  previousStatus?: LeadStatus | null;
};

export async function POST(request: Request) {
  const crmUser = await getCurrentCrmUser();

  if (!crmUser || !crmUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as FollowUpPayload | null;
  const leadId = typeof payload?.leadId === "string" ? payload.leadId : null;
  const followUpAt =
    typeof payload?.followUpAt === "string" && payload.followUpAt.trim()
      ? payload.followUpAt
      : null;

  if (!leadId || !followUpAt) {
    return NextResponse.json(
      { error: "Missing required follow-up fields." },
      { status: 400 }
    );
  }

  const status: LeadStatus = "follow_up_required";
  const supabase = createAdminSupabaseClient();

  const { error: leadError } = await supabase
    .from("leads")
    .update({
      status,
      next_follow_up_at: followUpAt,
    })
    .eq("id", leadId);

  if (leadError) {
    return NextResponse.json(
      { error: `Failed to save follow-up: ${leadError.message}` },
      { status: 500 }
    );
  }

  const { error: activityError } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    user_id: crmUser.id,
    actor_name: crmUser.full_name,
    activity_type: "note",
    action_label: "Manual Follow Up Scheduled",
    note_text: null,
    previous_status: payload?.previousStatus ?? null,
    new_status: status,
    follow_up_set_for: followUpAt,
  });

  if (activityError) {
    return NextResponse.json(
      { error: `Follow-up saved, but failed to record activity: ${activityError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status,
    nextFollowUpAt: followUpAt,
  });
}
