import { createBrowserSupabaseClient } from "@/lib/db/client";
import type { LeadSource } from "@/features/lead-sources/types";

export async function fetchLeadSources(): Promise<LeadSource[]> {
  const supabase = createBrowserSupabaseClient();

  const { data, error } = await supabase
    .from("lead_sources")
    .select("id, name, is_active")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load lead sources: ${error.message}`);
  }

  return (data ?? []) as LeadSource[];
}

export async function createLeadSource(name: string): Promise<LeadSource> {
  const supabase = createBrowserSupabaseClient();

  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Lead source name is required.");
  }

  const { data, error } = await supabase
    .from("lead_sources")
    .insert({
      name: trimmed,
      is_active: true,
    })
    .select("id, name, is_active")
    .single();

  if (error) {
    throw new Error(`Failed to create lead source: ${error.message}`);
  }

  return data as LeadSource;
}

export async function toggleLeadSource(sourceId: string): Promise<LeadSource[]> {
  const supabase = createBrowserSupabaseClient();

  const { data: existing, error: fetchError } = await supabase
    .from("lead_sources")
    .select("id, is_active")
    .eq("id", sourceId)
    .single();

  if (fetchError || !existing) {
    throw new Error(
      `Failed to find lead source: ${fetchError?.message ?? "Unknown error"}`
    );
  }

  const { error: updateError } = await supabase
    .from("lead_sources")
    .update({ is_active: !existing.is_active })
    .eq("id", sourceId);

  if (updateError) {
    throw new Error(`Failed to toggle lead source: ${updateError.message}`);
  }

  return fetchLeadSources();
}
