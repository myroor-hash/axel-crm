import { redirect } from "next/navigation";
import { MfaForm } from "@/components/auth/mfa-form";
import { getCurrentMfaLevel, getCurrentUser } from "@/lib/auth/session";

export default async function MfaPage() {
  const authBypassEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.CRM_DEV_BYPASS_AUTH === "true";

  if (authBypassEnabled) {
    redirect("/");
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { currentLevel } = await getCurrentMfaLevel();

  if (currentLevel === "aal2") {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <MfaForm />
    </main>
  );
}
