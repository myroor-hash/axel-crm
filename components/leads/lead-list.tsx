import type { LeadQueueItem } from "@/features/leads/types";

type QueueLead = LeadQueueItem & {
  computed_follow_up_at?: string | null;
  computed_follow_up_due?: boolean;
  computed_status_badge?: string;
  computed_priority?: number;
};

export function LeadList({
  leads,
  selectedLeadId,
  onSelectLead,
}: {
  leads: QueueLead[];
  selectedLeadId: string | null;
  onSelectLead: (leadId: string) => void;
}) {
  function formatLastContact(value: string | null) {
    if (!value) return "Never";

    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function leadSubline(row: QueueLead) {
    const parts = [row.contact_name, row.town_city, row.phone_number].filter(Boolean);
    return parts.join(" · ") || "—";
  }

  function formatFollowUp(value: string | null | undefined) {
    if (!value) return null;

    return new Date(value).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-950 px-5 py-4 text-white">
        <h2 className="text-lg font-semibold tracking-tight text-white">
          Call Queue
        </h2>
        <p className="mt-1 text-sm text-slate-200">
          Follow-ups first, then untouched leads, then oldest contacted leads.
        </p>
      </div>

      <div className="grid grid-cols-[2.2fr_1.2fr_1fr_1fr] gap-4 border-b border-slate-200 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <div>Lead</div>
        <div>Last Contact</div>
        <div>Status</div>
        <div>Lock</div>
      </div>

      {leads.map((row) => (
        <button
          key={row.id}
          type="button"
          onClick={() => onSelectLead(row.id)}
          className={`grid w-full grid-cols-[2.2fr_1.2fr_1fr_1fr] gap-4 border-b border-slate-100 px-5 py-4 text-left text-sm text-slate-700 last:border-b-0 hover:bg-slate-50 ${
            selectedLeadId === row.id ? "bg-slate-50" : "bg-white"
          }`}
        >
          <div>
            <div className="flex items-center gap-2">
              <p className="font-medium text-slate-900">{row.shop_name}</p>
              {row.computed_follow_up_due ? (
                <span
                  className="inline-flex items-center rounded-full border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-900"
                  title="Follow-up due now"
                >
                  Phone Now
                </span>
              ) : null}
            </div>
            <p className="text-slate-500">{leadSubline(row)}</p>
            {row.computed_follow_up_at ? (
              <p className="mt-1 text-xs font-medium text-slate-700">
                Callback: {formatFollowUp(row.computed_follow_up_at)}
              </p>
            ) : null}
          </div>

          <div>{formatLastContact(row.last_contacted_at)}</div>

          <div>
            <span
              className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                row.computed_follow_up_due
                  ? "border border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border border-slate-200 bg-slate-50 text-slate-700"
              }`}
            >
              {row.computed_status_badge ?? row.status}
            </span>
          </div>

          <div>{row.is_locked ? `🔒 ${row.locked_by_name ?? "Locked"}` : "Available"}</div>
        </button>
      ))}
    </div>
  );
}
