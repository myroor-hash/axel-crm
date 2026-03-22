"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/db/client";

type TotpFactor = {
  id: string;
  status?: string;
  friendly_name?: string | null;
};

function toQrImageSrc(qrCode: string | null) {
  if (!qrCode) return null;
  if (qrCode.startsWith("data:")) return qrCode;
  if (qrCode.startsWith("<svg")) {
    return `data:image/svg+xml;utf8,${encodeURIComponent(qrCode)}`;
  }
  return qrCode;
}

export function MfaForm() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserSupabaseClient(), []);
  const [step, setStep] = useState<"loading" | "enroll" | "verify">("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let ignore = false;

    async function loadMfaState() {
      try {
        const [{ data: assuranceData, error: assuranceError }, { data: factorsData, error: factorsError }] =
          await Promise.all([
            supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
            supabase.auth.mfa.listFactors(),
          ]);

        if (assuranceError) {
          throw assuranceError;
        }

        if (factorsError) {
          throw factorsError;
        }

        if (assuranceData.currentLevel === "aal2") {
          router.replace("/");
          router.refresh();
          return;
        }

        const verifiedFactor = (factorsData.totp ?? []).find(
          (factor) => factor.status === "verified"
        ) as TotpFactor | undefined;

        if (!ignore) {
          if (verifiedFactor) {
            setFactorId(verifiedFactor.id);
            setStep("verify");
            return;
          }

          const { data: enrollmentData, error: enrollmentError } =
            await supabase.auth.mfa.enroll({
              factorType: "totp",
              friendlyName: "CRM Authenticator",
            });

          if (enrollmentError) {
            throw enrollmentError;
          }

          setFactorId(enrollmentData.id);
          setQrCode(enrollmentData.totp.qr_code ?? null);
          setSecret(enrollmentData.totp.secret ?? null);
          setStep("enroll");
        }
      } catch (stateError) {
        if (!ignore) {
          setError(
            stateError instanceof Error
              ? stateError.message
              : "Unable to prepare multi-factor authentication."
          );
          setStep("verify");
        }
      }
    }

    void loadMfaState();

    return () => {
      ignore = true;
    };
  }, [router, supabase]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!factorId) {
      setError("No authenticator factor is ready yet.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
        factorId,
        code: code.trim(),
      });

      if (verifyError) {
        throw verifyError;
      }

      await fetch("/api/auth/trusted-device", {
        method: "POST",
      });

      router.replace("/");
      router.refresh();
    } catch (submissionError) {
      setError(
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to verify the authentication code."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const qrImageSrc = toQrImageSrc(qrCode);

  return (
    <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
            Axels CRM - lets get busy...
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">
            {step === "enroll" ? "Set Up 2FA" : "Verify 2FA"}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {step === "enroll"
              ? "Scan the QR code with your authenticator app, then enter the 6-digit code to finish setup."
              : "Enter the 6-digit code from your authenticator app to access the CRM."}
          </p>
        </div>
      </div>

      {step === "loading" ? (
        <p className="mt-6 text-sm text-slate-600">Loading security setup...</p>
      ) : null}

      {step === "enroll" && qrImageSrc ? (
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <div className="mx-auto h-48 w-48 overflow-hidden rounded-xl bg-white p-3">
            <Image
              src={qrImageSrc}
              alt="Authenticator QR code"
              width={180}
              height={180}
              unoptimized
            />
          </div>
          {secret ? (
            <p className="mt-4 break-all rounded-xl bg-white px-3 py-2 text-xs text-slate-700">
              Manual code: {secret}
            </p>
          ) : null}
        </div>
      ) : null}

      {step !== "loading" ? (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="mfa-code"
              className="text-xs font-semibold uppercase tracking-wide text-slate-600"
            >
              Authenticator Code
            </label>
            <input
              id="mfa-code"
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\s+/g, ""))}
              placeholder="123456"
              className="mt-2 w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
              autoComplete="one-time-code"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            {isSubmitting
              ? step === "enroll"
                ? "Setting up..."
                : "Verifying..."
              : step === "enroll"
                ? "Complete 2FA Setup"
                : "Verify Code"}
          </button>
        </form>
      ) : null}

      {error ? (
        <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </p>
      ) : null}
    </div>
  );
}
