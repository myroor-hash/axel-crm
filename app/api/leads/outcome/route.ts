import { NextResponse } from "next/server";
import { getCurrentCrmUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/db/admin";
import type { LeadStatus } from "@/features/leads/types";

type OutcomePayload = {
  leadId?: string;
  actionLabel?: string;
  noteText?: string | null;
  previousStatus?: LeadStatus | null;
  manualFollowUpAt?: string | null;
};

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

export async function POST(request: Request) {
  const crmUser = await getCurrentCrmUser();

  if (!crmUser || !crmUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as OutcomePayload | null;
  const leadId = typeof payload?.leadId === "string" ? payload.leadId : null;
  const actionLabel =
    typeof payload?.actionLabel === "string" ? payload.actionLabel : null;

  if (!leadId || !actionLabel) {
    return NextResponse.json(
      { error: "Missing required call outcome fields." },
      { status: 400 }
    );
  }

  const noteText =
    typeof payload?.noteText === "string" && payload.noteText.trim()
      ? payload.noteText.trim()
      : null;
  const previousStatus = payload?.previousStatus ?? null;
  const mapped = mapCallAction(actionLabel);
  const nextFollowUpAt =
    typeof payload?.manualFollowUpAt === "string" && payload.manualFollowUpAt.trim()
      ? payload.manualFollowUpAt
      : mapped.followUpAt;
  const status =
    mapped.status === "customer"
      ? "customer"
      : mapped.status === "information_sent"
        ? "information_sent"
        : nextFollowUpAt
          ? "follow_up_required"
          : mapped.status;
  const lastContactedAt = new Date().toISOString();

  const supabase = createAdminSupabaseClient();

  const { error: leadError } = await supabase
    .from("leads")
    .update({
      status,
      last_contacted_at: lastContactedAt,
      next_follow_up_at: nextFollowUpAt,
      last_outcome: mapped.callOutcome,
    })
    .eq("id", leadId);

  if (leadError) {
    return NextResponse.json(
      { error: `Failed to update lead after call: ${leadError.message}` },
      { status: 500 }
    );
  }

  const { error: activityError } = await supabase.from("lead_activities").insert({
    lead_id: leadId,
    user_id: crmUser.id,
    actor_name: crmUser.full_name,
    activity_type: "call",
    action_label: actionLabel,
    note_text: noteText,
    call_outcome: mapped.callOutcome,
    previous_status: previousStatus,
    new_status: status,
    follow_up_set_for: nextFollowUpAt,
  });

  if (activityError) {
    return NextResponse.json(
      { error: `Lead updated, but failed to record activity: ${activityError.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    status,
    lastContactedAt,
    nextFollowUpAt,
  });
}
