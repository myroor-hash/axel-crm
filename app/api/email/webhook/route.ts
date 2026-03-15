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
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "Missing webhook signing secret." },
      { status: 500 }
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${webhookSecret}`) {
    return NextResponse.json({ error: "Unauthorized webhook." }, { status: 401 });
  }

  const payload = (await request.json()) as ResendWebhookPayload;
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
  const { error } = await supabase
    .from("lead_emails")
    .update({
      ...update,
      last_event_at: eventTime,
    })
    .eq("resend_email_id", providerMessageId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
