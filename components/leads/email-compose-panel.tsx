"use client";

import { useMemo, useState } from "react";
import type { AttachmentOption } from "@/features/attachments/types";
import type { LeadDetail } from "@/features/leads/types";

function buildEmailBody(contactName: string, resource?: AttachmentOption | null) {
  const resourceCopy = resource
    ? `You can review it here:\n${resource.url}\n`
    : "";

  return `Hi ${contactName},

Great speaking earlier.

As promised, here is the information we discussed.

${resourceCopy}
Please let me know if you'd like to discuss the range or try a sample.

Best regards,
Axel Elixir`;
}

export function EmailComposePanel({
  lead,
  attachments,
  onCancel,
  onSend,
  embedded = false,
}: {
  lead: LeadDetail;
  attachments: AttachmentOption[];
  onCancel: () => void;
  onSend: (payload: {
    subject: string;
    body: string;
    attachmentIds: string[];
  }) => void;
  embedded?: boolean;
}) {
  const contactName = useMemo(() => {
    return lead.contact_first_name?.trim() || "there";
  }, [lead.contact_first_name]);
  const defaultResource = null;

  const [subject, setSubject] = useState("Great speaking earlier");
  const [body, setBody] = useState(buildEmailBody(contactName, defaultResource));

  const [selectedAttachmentIds, setSelectedAttachmentIds] = useState<string[]>(
    []
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const wrapperClass = embedded
    ? "rounded-xl border border-slate-200 bg-slate-50 p-4"
    : "rounded-2xl border border-slate-200 bg-white p-6 shadow-sm";

  async function handleSend() {
    setErrorMessage(null);
    setIsSending(true);

    try {
      const selectedResources = attachments.filter((file) =>
        selectedAttachmentIds.includes(file.id)
      );
      const missingLinks = selectedResources
        .filter((file) => !body.includes(file.url))
        .map((file) => `${file.label}\n${file.url}`);
      const outgoingBody = missingLinks.length
        ? `${body.trim()}\n\nDownload links:\n${missingLinks.join("\n\n")}`
        : body;

      await onSend({
        subject,
        body: outgoingBody,
        attachmentIds: selectedAttachmentIds,
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to send email."
      );
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className={wrapperClass}>
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Prepared Email
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Review the message, choose the email link, then send.
        </p>
        <p className="mt-2 text-sm font-medium text-slate-800">
          To: <span className="font-semibold">{lead.email ?? "No email set"}</span>
        </p>
      </div>

      <div className="mt-6 space-y-4">
        <div>
          <label className="text-xs uppercase text-slate-500">Subject</label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </div>

        <div>
          <label className="text-xs uppercase text-slate-500">Message</label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={10}
            className="mt-2 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
          />
        </div>

        <div>
          <label className="text-xs uppercase text-slate-500">Email Links</label>
          <div className="mt-2 space-y-2 rounded-xl border border-slate-300 bg-white px-3 py-3">
            {attachments.map((file) => (
              <label
                key={file.id}
                className="flex items-start gap-3 text-sm text-slate-900"
              >
                <input
                  type="checkbox"
                  checked={selectedAttachmentIds.includes(file.id)}
                  onChange={(e) =>
                    setSelectedAttachmentIds((prev) =>
                      e.target.checked
                        ? [...prev, file.id]
                        : prev.filter((id) => id !== file.id)
                    )
                  }
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-slate-900"
                />
                <span>
                  <span className="font-medium">{file.label}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {file.url}
                  </span>
                </span>
              </label>
            ))}
            {attachments.length === 0 ? (
              <p className="text-sm text-slate-500">No email links available.</p>
            ) : null}
          </div>
        </div>

        {errorMessage ? (
          <p className="text-sm font-medium text-red-700">{errorMessage}</p>
        ) : null}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-slate-50 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
          >
            {isSending ? "Sending..." : "Send Email"}
          </button>

          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
