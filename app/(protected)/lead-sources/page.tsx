import { LeadSourceManager } from "@/components/admin/lead-source-manager";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageHeader } from "@/components/layout/page-header";

export default function LeadSourcesPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1000px] space-y-6">
        <PageHeader
          title="Lead Sources"
          description="Manage the source names used across imports and sales reporting."
          actions={<LogoutButton />}
        />

        <LeadSourceManager />
      </div>
    </main>
  );
}
