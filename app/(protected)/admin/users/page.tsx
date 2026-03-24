import { notFound } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { PageHeader } from "@/components/layout/page-header";
import { UserManager } from "@/components/admin/user-manager";
import { getCurrentCrmUser } from "@/lib/auth/session";
import { createAdminSupabaseClient } from "@/lib/db/admin";

export default async function AdminUsersPage() {
  const currentCrmUser = await getCurrentCrmUser();

  if (!currentCrmUser || currentCrmUser.role !== "admin" || !currentCrmUser.is_active) {
    notFound();
  }

  const supabase = createAdminSupabaseClient();
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, email, role, is_active, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Failed to load CRM users: ${error.message}`);
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1200px] space-y-6">
        <PageHeader
          title="Admin Users"
          description="Hidden admin-only page for adding and reviewing CRM users."
          actions={<LogoutButton />}
        />

        <UserManager
          initialUsers={(data ?? []) as never[]}
          currentUserId={currentCrmUser.id}
        />
      </div>
    </main>
  );
}
