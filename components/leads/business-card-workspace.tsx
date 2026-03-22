"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { recognize } from "tesseract.js";
import { NewLeadWorkspace, type NewLeadFormValues } from "@/components/leads/new-lead-workspace";
import type { LeadSource } from "@/features/lead-sources/types";

function cleanLine(line: string) {
  return line.replace(/\s+/g, " ").trim();
}

function isLikelyPhone(line: string) {
  const digits = line.replace(/\D/g, "");
  return digits.length >= 10 && /(\+?\d|\(\d)/.test(line);
}

function isLikelyEmail(line: string) {
  return /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i.test(line);
}

function isLikelyWebsite(line: string) {
  return /(https?:\/\/|www\.|[A-Z0-9.-]+\.(com|co\.uk|uk|net|org))/i.test(line);
}

function isLikelyPostcode(line: string) {
  return /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/i.test(line);
}

function extractFirstMatch(text: string, pattern: RegExp) {
  const match = text.match(pattern);
  return match?.[0]?.trim() ?? "";
}

function titleCase(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function extractBusinessCardFields(rawText: string): Partial<NewLeadFormValues> {
  const lines = rawText
    .split(/\r?\n/)
    .map(cleanLine)
    .filter(Boolean);

  const email = extractFirstMatch(
    rawText,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
  );
  const postcode = extractFirstMatch(
    rawText.toUpperCase(),
    /\b[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}\b/
  );
  const phoneNumber =
    lines.find((line) => isLikelyPhone(line) && !isLikelyEmail(line)) ?? "";

  const candidateLines = lines.filter(
    (line) =>
      !isLikelyEmail(line) &&
      !isLikelyPhone(line) &&
      !isLikelyWebsite(line)
  );

  const contactName =
    candidateLines.find((line) => {
      const words = line.split(" ").filter(Boolean);
      return (
        words.length >= 2 &&
        words.length <= 4 &&
        !/\b(ltd|limited|llp|co|company|shop|pet|raw|foods|group)\b/i.test(line)
      );
    }) ?? "";

  const shopName =
    candidateLines.find((line) => line !== contactName) ??
    candidateLines[0] ??
    "";

  const addressLines = candidateLines.filter(
    (line) =>
      line !== contactName &&
      line !== shopName &&
      (/\d/.test(line) ||
        /\b(road|rd|street|st|lane|ln|avenue|ave|park|way|close|court|drive|industrial|estate|unit|house)\b/i.test(
          line
        ) ||
        isLikelyPostcode(line))
  );

  const townCity =
    candidateLines.find(
      (line) =>
        line !== contactName &&
        line !== shopName &&
        line !== addressLines[0] &&
        line !== addressLines[1] &&
        !isLikelyPostcode(line) &&
        /^[A-Za-z\s.'-]+$/.test(line)
    ) ?? "";

  const website =
    lines.find((line) => isLikelyWebsite(line) && !isLikelyEmail(line)) ?? "";

  return {
    shopName,
    contactName: titleCase(contactName),
    phoneNumber,
    email,
    addressLine1: addressLines[0] ?? "",
    addressLine2: addressLines[1] ?? "",
    addressLine3: "",
    townCity,
    countyRegion: "",
    postcode,
    priorityNote: website
      ? `Captured from business card. Website spotted: ${website}`
      : "Captured from business card.",
  };
}

export function BusinessCardWorkspace({
  leadSources,
}: {
  leadSources: LeadSource[];
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [rawText, setRawText] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [formSeed, setFormSeed] = useState<Partial<NewLeadFormValues>>({});
  const [formVersion, setFormVersion] = useState(0);

  const extractedSummary = useMemo(
    () => extractBusinessCardFields(rawText),
    [rawText]
  );

  async function handleFileUpload(file: File) {
    setErrorMessage(null);
    setIsScanning(true);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const result = await recognize(file, "eng");
      const text = result.data.text?.trim() ?? "";
      setRawText(text);
      setFormSeed((prev) => ({
        ...prev,
        ...extractBusinessCardFields(text),
      }));
      setFormVersion((prev) => prev + 1);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to read the business card image."
      );
    } finally {
      setIsScanning(false);
    }
  }

  const primaryButton =
    "rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50";

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="border-b border-slate-100 pb-4">
          <h2 className="text-xl font-semibold text-slate-900">Business Card Capture</h2>
          <p className="mt-1 text-sm text-slate-700">
            Upload a business card image and the CRM will try to pull out the
            lead details for you to review before saving.
          </p>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-4">
            <div>
              <label className={`inline-flex cursor-pointer items-center justify-center ${primaryButton}`}>
                Upload Business Card
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void handleFileUpload(file);
                    }
                  }}
                />
              </label>
              {isScanning ? (
                <p className="mt-3 text-sm font-medium text-slate-700">
                  Reading the card and extracting details...
                </p>
              ) : null}
              {errorMessage ? (
                <p className="mt-3 text-sm font-medium text-red-700">{errorMessage}</p>
              ) : null}
            </div>

            {previewUrl ? (
              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <Image
                  src={previewUrl}
                  alt="Business card preview"
                  width={1200}
                  height={700}
                  unoptimized
                  className="max-h-[320px] w-full rounded-xl object-contain"
                />
              </div>
            ) : null}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-700">
              Extracted Details
            </h3>
            {rawText ? (
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <p>
                  <span className="font-medium text-slate-900">Business:</span>{" "}
                  {extractedSummary.shopName || "—"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Contact:</span>{" "}
                  {extractedSummary.contactName || "—"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Phone:</span>{" "}
                  {extractedSummary.phoneNumber || "—"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Email:</span>{" "}
                  {extractedSummary.email || "—"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Postcode:</span>{" "}
                  {extractedSummary.postcode || "—"}
                </p>
                <div>
                  <p className="font-medium text-slate-900">Raw OCR Text</p>
                  <pre className="mt-2 whitespace-pre-wrap rounded-xl bg-white p-3 text-xs text-slate-700">
                    {rawText}
                  </pre>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-600">
                Upload a card image and the extracted details will appear here
                before the lead form below is filled in.
              </p>
            )}
          </div>
        </div>
      </div>

      <NewLeadWorkspace
        key={formVersion}
        leadSources={leadSources}
        initialValues={formSeed}
        title="Review and Create Lead"
        description="Check the OCR result, correct anything that looks off, then save the lead into the CRM."
      />
    </div>
  );
}
