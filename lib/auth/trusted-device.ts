import { createHmac, timingSafeEqual } from "node:crypto";

export const TRUSTED_MFA_COOKIE = "crm_trusted_mfa";
const TRUSTED_MFA_TTL_MS = 15 * 24 * 60 * 60 * 1000;

function getSigningSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("Missing signing secret for trusted MFA cookie.");
  }

  return secret;
}

function signPayload(payload: string) {
  return createHmac("sha256", getSigningSecret()).update(payload).digest("hex");
}

export function createTrustedMfaCookieValue(userId: string) {
  const expiresAt = Date.now() + TRUSTED_MFA_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function getTrustedMfaExpiryDate() {
  return new Date(Date.now() + TRUSTED_MFA_TTL_MS);
}

export function isTrustedMfaCookieValid(
  cookieValue: string | undefined,
  userId: string | null | undefined
) {
  if (!cookieValue || !userId) {
    return false;
  }

  const [cookieUserId, expiresAtRaw, signature] = cookieValue.split(".");

  if (!cookieUserId || !expiresAtRaw || !signature) {
    return false;
  }

  if (cookieUserId !== userId) {
    return false;
  }

  const expiresAt = Number(expiresAtRaw);

  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return false;
  }

  const payload = `${cookieUserId}.${expiresAtRaw}`;
  const expectedSignature = signPayload(payload);

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch {
    return false;
  }
}
