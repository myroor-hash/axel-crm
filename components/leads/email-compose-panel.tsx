"use client";

import { useMemo, useState } from "react";
import type { AttachmentOption } from "@/features/attachments/types";
import type { LeadDetail } from "@/features/leads/types";

export function EmailComposePanel({
  lead,
  attachments,
  onCancel,
  onSend,
}: {
  lead: LeadDetail;
  attachments: AttachmentOption[];
  onCancel: () => void;
  onSend: (payload: {
    subject: string;
    body: string;
    attachmentId: string;
  }) => void;
}) {
  const contactName = useMemo(() => {
    return lead.contact_first_name?.trim() || "there";
  }, [lead.contact_first_name]);

  const [subject, setSubject] = useState("Great speaking earlier");
  const [body, setBody] = useState(
    `Hi ${contactName},

Great speaking earlier.

As promised, I’ve attached our Axel Elixir information sheet for review.

Please let me know if you’d like to discuss the range or try a sample.

Best regards,
Axel Elixir`
  );

  const [attachmentId, setAttachmentId] = useState(
    attachments[0]?.id ?? ""
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSend() {
    setErrorMessage(null);
    setIsSending(true);

    try {
      await onSend({
        subject,
        body,
        attachmentId,
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
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="border-b border-slate-100 pb-4">
        <h2 className="text-xl font-semibold text-slate-900">
          Prepared Email
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Review the message, choose the PDF, then send.
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
          <label className="text-xs uppercase text-slate-500">Attachment</label>
          <select
            value={attachmentId}
            onChange={(e) => setAttachmentId(e.target.value)}
            className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
          >
            <option value="">No attachment</option>
            {attachments.map((file) => (
              <option key={file.id} value={file.id}>
                {file.fileName}
              </option>
            ))}
          </select>
        </div>

        {errorMessage ? (
          <p className="text-sm font-medium text-red-700">{errorMessage}</p>
        ) : null}

        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={handleSend}
            disabled={isSending}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
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
