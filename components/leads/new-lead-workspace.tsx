"use client";

import { useEffect, useMemo, useState } from "react";
import { createLeadSource } from "@/features/lead-sources/queries";
import { createManualLead } from "@/features/leads/queries";
import type { LeadSource } from "@/features/lead-sources/types";

type LeadKind = "prospect" | "customer";

export type NewLeadFormValues = {
  leadKind: LeadKind;
  leadSourceId: string;
  customerNumber: string;
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
  priorityNote: string;
};

const emptyForm: NewLeadFormValues = {
  leadKind: "prospect",
  leadSourceId: "",
  customerNumber: "",
  shopName: "",
  contactName: "",
  phoneNumber: "",
  email: "",
  addressLine1: "",
  addressLine2: "",
  addressLine3: "",
  townCity: "",
  countyRegion: "",
  postcode: "",
  priorityNote: "",
};

export function NewLeadWorkspace({
  leadSources,
  initialValues,
  title = "New Lead",
  description = "Add a single prospect or customer manually, including where the lead came from and any call context worth keeping.",
}: {
  leadSources: LeadSource[];
  initialValues?: Partial<NewLeadFormValues>;
  title?: string;
  description?: string;
}) {
  const [sources, setSources] = useState<LeadSource[]>(leadSources);
  const [newSourceName, setNewSourceName] = useState("");
  const [showNewSourceInput, setShowNewSourceInput] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLookingUpPostcode, setIsLookingUpPostcode] = useState(false);
  const [resultMessage, setResultMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [postcodeMessage, setPostcodeMessage] = useState<string | null>(null);
  const [form, setForm] = useState<NewLeadFormValues>({
    ...emptyForm,
    ...initialValues,
  });

  useEffect(() => {
    if (!initialValues) return;

    setForm((prev) => ({
      ...prev,
      ...initialValues,
    }));
  }, [initialValues]);

  const activeSources = useMemo(
    () => sources.filter((source) => source.is_active),
    [sources]
  );

  const primaryButton =
    "rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:opacity-50";
  const secondaryButton =
    "rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-100 active:scale-[0.98]";
  const inputClass =
    "mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900";

  function updateField<K extends keyof typeof form>(field: K, value: (typeof form)[K]) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  }

  async function handleAddSource() {
    const trimmed = newSourceName.trim();
    if (!trimmed) return;

    const created = await createLeadSource(trimmed);
    setSources((prev) => [...prev, created]);
    setForm((prev) => ({
      ...prev,
      leadSourceId: created.id,
    }));
    setNewSourceName("");
    setShowNewSourceInput(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSubmitting(true);
    setErrorMessage(null);
    setResultMessage(null);

    try {
      await createManualLead({
        leadKind: form.leadKind,
        leadSourceId: form.leadSourceId || null,
        externalRef: form.customerNumber.trim() || null,
        shopName: form.shopName.trim(),
        contactName: form.contactName.trim() || null,
        phoneNumber: form.phoneNumber.trim(),
        email: form.email.trim() || null,
        addressLine1: form.addressLine1.trim() || null,
        addressLine2: form.addressLine2.trim() || null,
        addressLine3: form.addressLine3.trim() || null,
        townCity: form.townCity.trim() || null,
        countyRegion: form.countyRegion.trim() || null,
        postcode: form.postcode.trim() || null,
        priorityNote: form.priorityNote.trim() || null,
      });

      setResultMessage(
        form.leadKind === "customer"
          ? "Customer added successfully."
          : "Prospect added successfully."
      );
      setForm((prev) => ({
        ...emptyForm,
        leadKind: prev.leadKind,
        leadSourceId: prev.leadSourceId,
      }));
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to create lead."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handlePostcodeLookup() {
    const postcode = form.postcode.trim();
    if (!postcode) {
      setPostcodeMessage("Enter a postcode first.");
      return;
    }

    setIsLookingUpPostcode(true);
    setPostcodeMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch(
        `https://api.postcodes.io/postcodes/${encodeURIComponent(postcode)}`
      );
      const payload = (await response.json()) as {
        status: number;
        result?: {
          admin_district?: string | null;
          parish?: string | null;
          admin_county?: string | null;
          region?: string | null;
        };
      };

      if (!response.ok || !payload.result) {
        setPostcodeMessage("No postcode match found.");
        return;
      }

      const townCity =
        payload.result.admin_district ?? payload.result.parish ?? "";
      const countyRegion =
        payload.result.admin_county ?? payload.result.region ?? "";

      setForm((prev) => ({
        ...prev,
        townCity: prev.townCity || townCity,
        countyRegion: prev.countyRegion || countyRegion,
      }));
      setPostcodeMessage("Town and county updated from postcode.");
    } catch {
      setPostcodeMessage("Unable to reach postcode lookup right now.");
    } finally {
      setIsLookingUpPostcode(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
        <p className="mt-1 text-sm text-slate-700">{description}</p>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Lead Type
            </label>
            <select
              value={form.leadKind}
              onChange={(event) =>
                updateField("leadKind", event.target.value as LeadKind)
              }
              className={inputClass}
            >
              <option value="prospect">Prospect</option>
              <option value="customer">Existing Customer</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Lead Source
            </label>
            <div className="mt-2 flex gap-3">
              <select
                value={form.leadSourceId}
                onChange={(event) => updateField("leadSourceId", event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="">Select source</option>
                {activeSources.map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={() => setShowNewSourceInput((prev) => !prev)}
                className={secondaryButton}
              >
                + New Source
              </button>
            </div>

            {showNewSourceInput ? (
              <div className="mt-3 flex gap-3">
                <input
                  type="text"
                  value={newSourceName}
                  onChange={(event) => setNewSourceName(event.target.value)}
                  placeholder="New source name..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleAddSource}
                  className={primaryButton}
                >
                  Save
                </button>
              </div>
            ) : null}
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Customer Number
            </label>
            <input
              type="text"
              value={form.customerNumber}
              onChange={(event) => updateField("customerNumber", event.target.value)}
              placeholder="Optional customer or account ref..."
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Shop Name
            </label>
            <input
              type="text"
              required
              value={form.shopName}
              onChange={(event) => updateField("shopName", event.target.value)}
              placeholder="Business name"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Contact Name
            </label>
            <input
              type="text"
              value={form.contactName}
              onChange={(event) => updateField("contactName", event.target.value)}
              placeholder="Buyer or contact"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Phone Number
            </label>
            <input
              type="text"
              required
              value={form.phoneNumber}
              onChange={(event) => updateField("phoneNumber", event.target.value)}
              placeholder="Telephone"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Email
            </label>
            <input
              type="email"
              value={form.email}
              onChange={(event) => updateField("email", event.target.value)}
              placeholder="name@shop.com"
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Postcode
            </label>
            <div className="mt-2 flex gap-3">
              <input
                type="text"
                value={form.postcode}
                onChange={(event) => updateField("postcode", event.target.value)}
                placeholder="Postcode"
                className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
              />
              <button
                type="button"
                onClick={handlePostcodeLookup}
                disabled={isLookingUpPostcode}
                className={secondaryButton}
              >
                {isLookingUpPostcode ? "Looking..." : "Lookup"}
              </button>
            </div>
            {postcodeMessage ? (
              <p className="mt-2 text-xs font-medium text-slate-600">
                {postcodeMessage}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Address Line 1
            </label>
            <input
              type="text"
              value={form.addressLine1}
              onChange={(event) => updateField("addressLine1", event.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Address Line 2
            </label>
            <input
              type="text"
              value={form.addressLine2}
              onChange={(event) => updateField("addressLine2", event.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Address Line 3
            </label>
            <input
              type="text"
              value={form.addressLine3}
              onChange={(event) => updateField("addressLine3", event.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              Town / City
            </label>
            <input
              type="text"
              value={form.townCity}
              onChange={(event) => updateField("townCity", event.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
              County / Region
            </label>
            <input
              type="text"
              value={form.countyRegion}
              onChange={(event) => updateField("countyRegion", event.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-700">
            Notes on Where This Lead Came From
          </label>
          <textarea
            value={form.priorityNote}
            onChange={(event) => updateField("priorityNote", event.target.value)}
            rows={4}
            placeholder="Referral, event, website enquiry, existing relationship, competitor switch, buyer request, or anything else useful for the first call."
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={isSubmitting} className={primaryButton}>
            {isSubmitting ? "Saving..." : "Create Lead"}
          </button>

          {resultMessage ? (
            <span className="text-sm font-medium text-emerald-700">{resultMessage}</span>
          ) : null}

          {errorMessage ? (
            <span className="text-sm font-medium text-red-700">{errorMessage}</span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
