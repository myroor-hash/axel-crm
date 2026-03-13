import { createBrowserSupabaseClient } from "@/lib/db/client";
import type { LeadReadOnlyState } from "@/features/locks/types";

export async function getLeadReadOnlyState(
  leadId: string
): Promise<LeadReadOnlyState> {
  const supabase = createBrowserSupabaseClient();
  const now = new Date().toISOString();

  const { data: lock, error: lockError } = await supabase
    .from("lead_locks")
    .select("user_id")
    .eq("lead_id", leadId)
    .eq("is_active", true)
    .is("released_at", null)
    .gt("expires_at", now)
    .order("locked_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lockError) {
    throw new Error(`Unable to load lead lock: ${lockError.message}`);
  }

  if (!lock) {
    return {
      isReadOnly: false,
      lockedByUserId: null,
      lockedByName: null,
    };
  }

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("full_name")
    .eq("id", String(lock.user_id))
    .maybeSingle();

  if (userError) {
    throw new Error(`Unable to load lock owner: ${userError.message}`);
  }

  return {
    isReadOnly: true,
    lockedByUserId: String(lock.user_id),
    lockedByName: typeof user?.full_name === "string" ? user.full_name : null,
  };
}
