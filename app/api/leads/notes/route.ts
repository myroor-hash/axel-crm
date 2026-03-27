import { NextResponse } from "next/server";
import { getCurrentCrmUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/db/admin";

type NotePayload = {
  leadId?: string;
  noteText?: string;
};

export async function GET(request: Request) {
  const crmUser = await getCurrentCrmUser();

  if (!crmUser || !crmUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const leadId = searchParams.get("leadId");

  if (!leadId) {
    return NextResponse.json({ error: "Missing lead id." }, { status: 400 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("lead_notes")
    .select("id, lead_id, user_id, actor_name, note_text, created_at")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (error) {
    if (error.code === "42P01") {
      return NextResponse.json({ rows: [] });
    }

    return NextResponse.json(
      { error: `Failed to load lead notes: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(request: Request) {
  const crmUser = await getCurrentCrmUser();

  if (!crmUser || !crmUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as NotePayload | null;
  const leadId = typeof payload?.leadId === "string" ? payload.leadId : null;
  const noteText =
    typeof payload?.noteText === "string" && payload.noteText.trim()
      ? payload.noteText.trim()
      : null;

  if (!leadId || !noteText) {
    return NextResponse.json(
      { error: "Missing required note fields." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabaseClient();
  const { error } = await supabase.from("lead_notes").insert({
    lead_id: leadId,
    user_id: crmUser.id,
    actor_name: crmUser.full_name,
    note_text: noteText,
  });

  if (error) {
    return NextResponse.json(
      { error: `Failed to save note: ${error.message}` },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
