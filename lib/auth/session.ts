import { createServerSupabaseClient } from "@/lib/db/server";
import { createAdminSupabaseClient } from "@/lib/db/admin";

const BOOTSTRAP_ADMIN_EMAIL = "nj@proffitt.org.uk";

type CrmUserRow = {
  id: string;
  auth_user_id: string | null;
  full_name: string;
  email: string;
  role: "admin" | "sales";
  is_active: boolean;
};

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

export async function getCurrentMfaLevel() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const accessToken = session?.access_token;

  if (!accessToken) {
    return {
      currentLevel: null as string | null,
      nextLevel: null as string | null,
    };
  }

  const { data, error } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel(accessToken);

  if (error) {
    throw error;
  }

  return {
    currentLevel: data.currentLevel,
    nextLevel: data.nextLevel,
  };
}

export async function getCurrentCrmUser() {
  const user = await getCurrentUser();

  if (!user?.email) {
    return null;
  }

  const supabase = createAdminSupabaseClient();
  const normalizedEmail = user.email.trim().toLowerCase();

  const { data: existingUsers, error } = await supabase
    .from("users")
    .select("id, auth_user_id, full_name, email, role, is_active")
    .or(`auth_user_id.eq.${user.id},email.eq.${normalizedEmail}`)
    .limit(1);

  if (error) {
    throw error;
  }

  const existingUser = ((existingUsers ?? [])[0] ?? null) as CrmUserRow | null;

  if (existingUser) {
    if (!existingUser.auth_user_id) {
      await supabase
        .from("users")
        .update({ auth_user_id: user.id })
        .eq("id", existingUser.id);
    }

    return {
      ...existingUser,
      auth_user_id: existingUser.auth_user_id ?? user.id,
    };
  }

  if (normalizedEmail !== BOOTSTRAP_ADMIN_EMAIL) {
    return null;
  }

  const { data: insertedUser, error: insertError } = await supabase
    .from("users")
    .insert({
      auth_user_id: user.id,
      full_name: "Nigel Proffitt",
      email: normalizedEmail,
      role: "admin",
      is_active: true,
    })
    .select("id, auth_user_id, full_name, email, role, is_active")
    .single();

  if (insertError) {
    throw insertError;
  }

  return insertedUser as CrmUserRow;
}
