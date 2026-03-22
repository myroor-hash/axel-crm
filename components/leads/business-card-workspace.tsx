"use client";

import Image from "next/image";
import { useState } from "react";
import { NewLeadWorkspace, type NewLeadFormValues } from "@/components/leads/new-lead-workspace";
import type { LeadSource } from "@/features/lead-sources/types";

type ExtractedBusinessCard = {
  shopName: string;
  contactName: string;
  phoneNumber: string;
  email: string;
  addressLine1: string;
  addressLine2: string;
  addressLine3: string;
  townCity: string;
  countyRegion: string;
  postcode: string;
  website: string;
  notes: string;
  rawText: string;
};

function mapExtractedToLeadSeed(
  extracted: ExtractedBusinessCard
): Partial<NewLeadFormValues> {
  return {
    shopName: extracted.shopName,
    contactName: extracted.contactName,
    phoneNumber: extracted.phoneNumber,
    email: extracted.email,
    addressLine1: extracted.addressLine1,
    addressLine2: extracted.addressLine2,
    addressLine3: extracted.addressLine3,
    townCity: extracted.townCity,
    countyRegion: extracted.countyRegion,
    postcode: extracted.postcode,
    priorityNote: extracted.notes,
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
  const [summary, setSummary] = useState<ExtractedBusinessCard | null>(null);

  async function handleFileUpload(file: File) {
    setErrorMessage(null);
    setIsScanning(true);
    setPreviewUrl(URL.createObjectURL(file));

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/business-card/extract", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json().catch(() => null)) as
        | { extracted?: ExtractedBusinessCard; error?: string }
        | null;

      if (!response.ok || !payload?.extracted) {
        throw new Error(payload?.error ?? "Unable to extract details from the business card.");
      }

      setSummary(payload.extracted);
      setRawText(payload.extracted.rawText ?? "");
      setFormSeed(mapExtractedToLeadSeed(payload.extracted));
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
            Upload a business card image and the CRM will pull out the lead
            details for you to review before saving.
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
            {summary ? (
              <div className="mt-4 space-y-3 text-sm text-slate-700">
                <p>
                  <span className="font-medium text-slate-900">Business:</span>{" "}
                  {summary.shopName || "—"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Contact:</span>{" "}
                  {summary.contactName || "—"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Phone:</span>{" "}
                  {summary.phoneNumber || "—"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Email:</span>{" "}
                  {summary.email || "—"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Postcode:</span>{" "}
                  {summary.postcode || "—"}
                </p>
                <p>
                  <span className="font-medium text-slate-900">Website:</span>{" "}
                  {summary.website || "—"}
                </p>
                <div>
                  <p className="font-medium text-slate-900">Raw Extracted Text</p>
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
        description="Check the extracted result, correct anything that looks off, then save the lead into the CRM."
      />
    </div>
  );
}
