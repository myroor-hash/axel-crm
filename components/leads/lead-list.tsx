import type { LeadQueueItem } from "@/features/leads/types";

type QueueLead = LeadQueueItem & {
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

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-5 py-4">
        <h2 className="text-lg font-semibold tracking-tight text-slate-900">
          Lead Queue
        </h2>
        <p className="mt-1 text-sm text-slate-600">
          Shared queue view for the sales team.
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
            <p className="font-medium text-slate-900">{row.shop_name}</p>
            <p className="text-slate-500">{leadSubline(row)}</p>
          </div>

          <div>{formatLastContact(row.last_contacted_at)}</div>

          <div>
            <span className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
              {row.computed_status_badge ?? row.status}
            </span>
          </div>

          <div>{row.is_locked ? `🔒 ${row.locked_by_name ?? "Locked"}` : "Available"}</div>
        </button>
      ))}
    </div>
  );
}

