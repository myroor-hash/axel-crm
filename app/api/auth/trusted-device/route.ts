import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import {
  createTrustedMfaCookieValue,
  getTrustedMfaExpiryDate,
  TRUSTED_MFA_COOKIE,
} from "@/lib/auth/trusted-device";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(TRUSTED_MFA_COOKIE, await createTrustedMfaCookieValue(user.id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: getTrustedMfaExpiryDate(),
  });

  return response;
}
