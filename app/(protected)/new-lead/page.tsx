import { LogoutButton } from "@/components/auth/logout-button";
import { PageHeader } from "@/components/layout/page-header";
import { NewLeadWorkspace } from "@/components/leads/new-lead-workspace";
import type { LeadSource } from "@/features/lead-sources/types";
import { createServerSupabaseClient } from "@/lib/db/server";

export default async function NewLeadPage() {
  const supabase = await createServerSupabaseClient();
  const { data: leadSources, error } = await supabase
    .from("lead_sources")
    .select("id, name, is_active")
    .order("name", { ascending: true });

  if (error) {
    throw new Error(`Failed to load lead sources: ${error.message}`);
  }

  const normalizedLeadSources: LeadSource[] = (leadSources ?? []).map((source) => ({
    id: String(source.id),
    name: String(source.name),
    is_active: Boolean(source.is_active),
  }));

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <PageHeader
          title="New Lead"
          description="Add a single customer or prospect manually and capture where the opportunity came from."
          actions={<LogoutButton />}
        />

        <NewLeadWorkspace leadSources={normalizedLeadSources} />
      </div>
    </main>
  );
}
