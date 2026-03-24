import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentCrmUser, getCurrentUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/db/admin";

const createUserSchema = z.object({
  fullName: z.string().min(2, "Enter the user's full name."),
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(10, "Use at least 10 characters for the password."),
});

const updateUserSchema = z.object({
  id: z.string().uuid("Invalid user id."),
  fullName: z.string().min(2, "Enter the user's full name."),
  email: z.string().email("Enter a valid email address."),
  isActive: z.boolean(),
});

const deleteUserSchema = z.object({
  id: z.string().uuid("Invalid user id."),
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

export async function PATCH(request: Request) {
  const authUser = await getCurrentUser();
  const crmUser = await getCurrentCrmUser();

  if (!authUser || crmUser?.role !== "admin" || !crmUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid user details." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabaseClient();
  const normalizedEmail = parsed.data.email.trim().toLowerCase();

  const { data: existingUser, error: fetchError } = await supabase
    .from("users")
    .select("id, auth_user_id, role")
    .eq("id", parsed.data.id)
    .single();

  if (fetchError || !existingUser) {
    return NextResponse.json(
      { error: fetchError?.message ?? "User not found." },
      { status: 404 }
    );
  }

  if (existingUser.role === "admin" && !parsed.data.isActive) {
    return NextResponse.json(
      { error: "The admin account cannot be deactivated." },
      { status: 400 }
    );
  }

  const { data: duplicateUser, error: duplicateError } = await supabase
    .from("users")
    .select("id")
    .eq("email", normalizedEmail)
    .neq("id", parsed.data.id)
    .maybeSingle();

  if (duplicateError) {
    return NextResponse.json({ error: duplicateError.message }, { status: 500 });
  }

  if (duplicateUser) {
    return NextResponse.json(
      { error: "Another user already has that email address." },
      { status: 400 }
    );
  }

  const { data: updatedUser, error: updateError } = await supabase
    .from("users")
    .update({
      full_name: parsed.data.fullName.trim(),
      email: normalizedEmail,
      is_active: parsed.data.isActive,
    })
    .eq("id", parsed.data.id)
    .select("id, full_name, email, role, is_active, created_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (existingUser.auth_user_id) {
    const authUserId = String(existingUser.auth_user_id);
    const { error: authUpdateError } = await supabase.auth.admin.updateUserById(
      authUserId,
      {
        email: normalizedEmail,
        user_metadata: {
          full_name: parsed.data.fullName.trim(),
        },
      }
    );

    if (authUpdateError) {
      return NextResponse.json({ error: authUpdateError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ user: updatedUser });
}

export async function DELETE(request: Request) {
  const authUser = await getCurrentUser();
  const crmUser = await getCurrentCrmUser();

  if (!authUser || crmUser?.role !== "admin" || !crmUser.is_active) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = deleteUserSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid user details." },
      { status: 400 }
    );
  }

  if (crmUser.id === parsed.data.id) {
    return NextResponse.json(
      { error: "You cannot delete your own admin account." },
      { status: 400 }
    );
  }

  const supabase = createAdminSupabaseClient();
  const { data: existingUser, error: fetchError } = await supabase
    .from("users")
    .select("id, auth_user_id, role")
    .eq("id", parsed.data.id)
    .single();

  if (fetchError || !existingUser) {
    return NextResponse.json(
      { error: fetchError?.message ?? "User not found." },
      { status: 404 }
    );
  }

  if (existingUser.role === "admin") {
    return NextResponse.json(
      { error: "The admin account cannot be deleted." },
      { status: 400 }
    );
  }

  const { error: deleteError } = await supabase
    .from("users")
    .delete()
    .eq("id", parsed.data.id);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 });
  }

  if (existingUser.auth_user_id) {
    const authUserId = String(existingUser.auth_user_id);
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(
      authUserId
    );

    if (authDeleteError) {
      return NextResponse.json({ error: authDeleteError.message }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}
