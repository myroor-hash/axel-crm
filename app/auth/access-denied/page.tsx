import { redirect } from "next/navigation";
import { LogoutButton } from "@/components/auth/logout-button";
import { getCurrentCrmUser, getCurrentUser } from "@/lib/auth/session";

export default async function AccessDeniedPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const crmUser = await getCurrentCrmUser();

  if (crmUser?.is_active) {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Axels CRM - lets get busy...
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
              Access Not Approved
            </h1>
            <p className="mt-3 text-sm text-slate-600">
              Your sign-in worked, but this email address has not been approved
              for CRM access yet. Please ask the admin to add you as a user.
            </p>
          </div>
          <LogoutButton />
        </div>
      </div>
    </main>
  );
}
