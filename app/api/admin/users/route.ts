import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentCrmUser, getCurrentUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/db/admin";

const createUserSchema = z.object({
  fullName: z.string().min(2, "Enter the user's full name."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters for the password."),
});

export async function GET() {
  const authUser = await getCurrentUser();
  const crmUser = await getCurrentCrmUser();

  if (!authUser || crmUser?.role !== "admin" || !crmUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role, is_active, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ users: data ?? [] });
}

export async function POST(request: Request) {
  const authUser = await getCurrentUser();
  const crmUser = await getCurrentCrmUser();

  if (!authUser || crmUser?.role !== "admin" || !crmUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = createUserSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid user details." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabaseClient();
  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email: normalizedEmail,
      password: parsed.data.password,
      email_confirm: true,
    });

  if (authError) {
    return NextResponse.json({ error: authError.message }, { status: 500 });
  }

  const authUserId = authData.user?.id;

  if (!authUserId) {
    return NextResponse.json(
      { error: "Supabase did not return a new auth user." },
      { status: 500 }
    );
  }

  const { data: createdUser, error: insertError } = await supabase
    .from("users")
    .insert({
      auth_user_id: authUserId,
      full_name: parsed.data.fullName.trim(),
      email: normalizedEmail,
      role: "sales",
      is_active: true,
    })
    .select("id, full_name, email, role, is_active, created_at")
    .single();

  if (insertError) {
    await supabase.auth.admin.deleteUser(authUserId);
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ user: createdUser });
}
