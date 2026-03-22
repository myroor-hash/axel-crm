import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  getCurrentCrmUser,
  getCurrentMfaLevel,
  getCurrentUser,
} from "@/lib/auth/session";
import {
  isTrustedMfaCookieValid,
  TRUSTED_MFA_COOKIE,
} from "@/lib/auth/trusted-device";

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
  const cookieStore = await cookies();
  const trustedMfaCookie = cookieStore.get(TRUSTED_MFA_COOKIE)?.value;
  const trustedDevice = await isTrustedMfaCookieValid(trustedMfaCookie, user.id);

  if (currentLevel !== "aal2" && !trustedDevice) {
    redirect("/auth/mfa");
  }

  const crmUser = await getCurrentCrmUser();

  if (!crmUser || !crmUser.is_active) {
    redirect("/auth/access-denied");
  }

  return children;
}
