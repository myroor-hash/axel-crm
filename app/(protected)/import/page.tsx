import { LeadImportWorkspace } from "@/components/import/lead-import-workspace";
import { PageHeader } from "@/components/layout/page-header";
import { fetchLeadSources } from "@/features/lead-sources/queries";

export default async function ImportPage() {
  const leadSources = await fetchLeadSources();

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1200px] space-y-6">

        <PageHeader
          title="Lead Import"
          description="Upload CSV or Excel files and add new leads to the call queue."
        />

        <LeadImportWorkspace leadSources={leadSources} />

      </div>
    </main>
  );
}

