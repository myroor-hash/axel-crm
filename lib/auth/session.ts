import { createServerSupabaseClient } from "@/lib/db/server";

export async function getCurrentUser() {
  const supabase = createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}

