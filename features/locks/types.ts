export interface LeadReadOnlyState {
  isReadOnly: boolean;
  lockedByUserId: string | null;
  lockedByName: string | null;
}
