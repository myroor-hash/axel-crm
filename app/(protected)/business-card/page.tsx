import { LogoutButton } from "@/components/auth/logout-button";
import { PageHeader } from "@/components/layout/page-header";
import { BusinessCardWorkspace } from "@/components/leads/business-card-workspace";
import type { LeadSource } from "@/features/lead-sources/types";
import { createServerSupabaseClient } from "@/lib/db/server";

export default async function BusinessCardPage() {
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
          title="Business Card Capture"
          description="Upload a business card image, let the CRM pull out the details, then review before saving the lead."
          actions={<LogoutButton />}
        />

        <BusinessCardWorkspace leadSources={normalizedLeadSources} />
      </div>
    </main>
  );
}
