import { NextResponse } from "next/server";
import { createAdminSupabaseClient } from "@/lib/db/admin";

type ResendWebhookPayload = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    created_at?: string;
  };
};

type LeadStatus =
  | "new"
  | "attempted_contact"
  | "spoke_to_contact"
  | "follow_up_required"
  | "information_sent"
  | "sample_sent"
  | "customer"
  | "dead_lead";

function mapWebhookTypeToUpdate(type: string, eventTime: string) {
  switch (type) {
    case "email.delivered":
      return {
        status: "delivered",
        delivered_at: eventTime,
      };
    case "email.opened":
      return {
        status: "opened",
        opened_at: eventTime,
      };
    case "email.clicked":
      return {
        status: "clicked",
        clicked_at: eventTime,
      };
    case "email.bounced":
      return {
        status: "bounced",
      };
    default:
      return null;
  }
}

export async function POST(request: Request) {
  const rawPayload = await request.text();
  const payload = JSON.parse(rawPayload) as ResendWebhookPayload;
  const eventType = payload.type ?? "";
  const providerMessageId = payload.data?.email_id ?? null;
  const eventTime =
    payload.data?.created_at ?? payload.created_at ?? new Date().toISOString();

  if (!providerMessageId) {
    return NextResponse.json({ error: "Missing provider message id." }, { status: 400 });
  }

  const update = mapWebhookTypeToUpdate(eventType, eventTime);
  if (!update) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createAdminSupabaseClient();
  const { data: updatedEmail, error } = await supabase
    .from("lead_emails")
    .update({
      ...update,
      last_event_at: eventTime,
    })
    .eq("resend_email_id", providerMessageId)
    .select("lead_id, sent_by_user_id, sent_by_name")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (eventType === "email.clicked" && updatedEmail?.lead_id) {
    const clickedAt = new Date(eventTime);
    const clickFollowUpAt = new Date(clickedAt.getTime() + 24 * 60 * 60 * 1000).toISOString();

    const { data: leadRow, error: leadLookupError } = await supabase
      .from("leads")
      .select("status, next_follow_up_at")
      .eq("id", updatedEmail.lead_id)
      .maybeSingle();

    if (leadLookupError) {
      return NextResponse.json({ error: leadLookupError.message }, { status: 500 });
    }

    const currentFollowUpAt =
      typeof leadRow?.next_follow_up_at === "string" ? leadRow.next_follow_up_at : null;
    const nextFollowUpAt =
      currentFollowUpAt &&
      new Date(currentFollowUpAt).getTime() <= new Date(clickFollowUpAt).getTime()
        ? currentFollowUpAt
        : clickFollowUpAt;

    const nextStatus: LeadStatus =
      leadRow?.status === "customer"
        ? "customer"
        : "follow_up_required";

    const { error: leadUpdateError } = await supabase
      .from("leads")
      .update({
        status: nextStatus,
        next_follow_up_at: nextFollowUpAt,
      })
      .eq("id", updatedEmail.lead_id);

    if (leadUpdateError) {
      return NextResponse.json({ error: leadUpdateError.message }, { status: 500 });
    }

    if (updatedEmail.sent_by_user_id) {
      const { error: activityError } = await supabase.from("lead_activities").insert({
        lead_id: updatedEmail.lead_id,
        user_id: updatedEmail.sent_by_user_id,
        actor_name: updatedEmail.sent_by_name ?? null,
        activity_type: "status_changed",
        action_label: "Email Link Clicked",
        note_text: "Follow up within 24 hours of click.",
        call_outcome: null,
        previous_status: leadRow?.status ?? null,
        new_status: nextStatus,
        follow_up_set_for: nextFollowUpAt,
      });

      if (activityError) {
        return NextResponse.json({ error: activityError.message }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
