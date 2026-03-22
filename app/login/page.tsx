import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getCurrentMfaLevel, getCurrentUser } from "@/lib/auth/session";

export default async function LoginPage() {
  const authBypassEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.CRM_DEV_BYPASS_AUTH === "true";

  if (authBypassEnabled) {
    redirect("/");
  }

  const user = await getCurrentUser();

  if (user) {
    const { currentLevel } = await getCurrentMfaLevel();
    redirect(currentLevel === "aal2" ? "/" : "/auth/mfa");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          Axels CRM - lets get busy...
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
          Sign In
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Use your approved email address and password to access the CRM.
        </p>

        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
