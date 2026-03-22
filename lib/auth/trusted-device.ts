export const TRUSTED_MFA_COOKIE = "crm_trusted_mfa";
const TRUSTED_MFA_TTL_MS = 15 * 24 * 60 * 60 * 1000;

function getSigningSecret() {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!secret) {
    throw new Error("Missing signing secret for trusted MFA cookie.");
  }

  return secret;
}

const textEncoder = new TextEncoder();

async function importHmacKey() {
  return crypto.subtle.importKey(
    "raw",
    textEncoder.encode(getSigningSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function signPayload(payload: string) {
  const key = await importHmacKey();
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    textEncoder.encode(payload)
  );

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEquals(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let result = 0;

  for (let index = 0; index < left.length; index += 1) {
    result |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return result === 0;
}

export async function createTrustedMfaCookieValue(userId: string) {
  const expiresAt = Date.now() + TRUSTED_MFA_TTL_MS;
  const payload = `${userId}.${expiresAt}`;
  const signature = await signPayload(payload);
  return `${payload}.${signature}`;
}

export function getTrustedMfaExpiryDate() {
  return new Date(Date.now() + TRUSTED_MFA_TTL_MS);
}

export async function isTrustedMfaCookieValid(
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
  const expectedSignature = await signPayload(payload);
  return timingSafeEquals(signature, expectedSignature);
}
