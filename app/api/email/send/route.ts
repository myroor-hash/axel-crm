import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/db/admin";

type SendEmailPayload = {
  leadId: string;
  to: string;
  subject: string;
  body: string;
  attachmentId: string;
  attachmentName: string;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function textToTrackedHtml(text: string) {
  const escaped = escapeHtml(text);
  const linked = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#0f172a;text-decoration:underline;">$1</a>'
  );

  return `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#0f172a;white-space:pre-wrap;">${linked.replace(/\n/g, "<br />")}</div>`;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const resendFromEmail = process.env.RESEND_FROM_EMAIL;

  if (!resendApiKey || !resendFromEmail) {
    return NextResponse.json(
      { error: "Missing email provider environment variables." },
      { status: 500 }
    );
  }

  const payload = (await request.json()) as Partial<SendEmailPayload>;

  if (!payload.leadId || !payload.to || !payload.subject || !payload.body) {
    return NextResponse.json({ error: "Missing required email fields." }, { status: 400 });
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: resendFromEmail,
      to: [payload.to],
      subject: payload.subject,
      text: payload.body,
      html: textToTrackedHtml(payload.body),
    }),
  });

  const responseData = (await response.json().catch(() => null)) as
    | { id?: string; message?: string; name?: string }
    | null;

  if (!response.ok || !responseData?.id) {
    const message =
      responseData?.message ?? responseData?.name ?? "Failed to send email.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  const supabase = createAdminSupabaseClient();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("lead_emails")
    .insert({
      lead_id: payload.leadId,
      resend_email_id: responseData.id,
      recipient_email: payload.to,
      sender_email: resendFromEmail,
      subject: payload.subject,
      body_text: payload.body,
      attachment_id: payload.attachmentId ?? null,
      attachment_name: payload.attachmentName ?? null,
      status: "sent",
      sent_at: now,
      last_event_at: now,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json(
      { error: `Email sent, but failed to save CRM record: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({
    emailId: data?.id ?? null,
    providerMessageId: responseData.id,
  });
}
