import type { LeadReadOnlyState } from "@/features/locks/types";

export async function getLeadReadOnlyState(
  leadId: string
): Promise<LeadReadOnlyState> {
  if (leadId === "lead-3") {
    return {
      isReadOnly: true,
      lockedByUserId: "user-dan",
      lockedByName: "Dan",
    };
  }

  return {
    isReadOnly: false,
    lockedByUserId: null,
    lockedByName: null,
  };
}
