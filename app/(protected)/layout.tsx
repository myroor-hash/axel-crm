import { redirect } from "next/navigation";
import {
  getCurrentCrmUser,
  getCurrentMfaLevel,
  getCurrentUser,
} from "@/lib/auth/session";

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authBypassEnabled =
    process.env.NODE_ENV !== "production" &&
    process.env.CRM_DEV_BYPASS_AUTH === "true";

  if (authBypassEnabled) {
    return children;
  }

  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const { currentLevel } = await getCurrentMfaLevel();

  if (currentLevel !== "aal2") {
    redirect("/auth/mfa");
  }

  const crmUser = await getCurrentCrmUser();

  if (!crmUser || !crmUser.is_active) {
    redirect("/auth/access-denied");
  }

  return children;
}
