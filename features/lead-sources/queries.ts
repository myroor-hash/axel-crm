import type { LeadSource } from "@/features/lead-sources/types";

let mockLeadSources: LeadSource[] = [
  { id: "source-1", name: "Paid List", is_active: true },
  { id: "source-2", name: "Website", is_active: true },
  { id: "source-3", name: "Shop Visit", is_active: true },
];

export async function fetchLeadSources(): Promise<LeadSource[]> {
  return mockLeadSources;
}

export async function createLeadSource(name: string): Promise<LeadSource> {
  const newSource: LeadSource = {
    id: `source-${Date.now()}`,
    name: name.trim(),
    is_active: true,
  };

  mockLeadSources = [...mockLeadSources, newSource];
  return newSource;
}

export async function toggleLeadSource(sourceId: string): Promise<LeadSource[]> {
  mockLeadSources = mockLeadSources.map((source) =>
    source.id === sourceId
      ? { ...source, is_active: !source.is_active }
      : source
  );

  return mockLeadSources;
}
