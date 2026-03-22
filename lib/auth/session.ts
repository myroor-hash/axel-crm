import { createServerSupabaseClient } from "@/lib/db/server";

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
