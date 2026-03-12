import type { AttachmentOption } from "@/features/attachments/types";

export async function fetchAttachmentOptions(): Promise<AttachmentOption[]> {
  return [
    { id: "brochure", fileName: "Axel_Brochure.pdf" },
    { id: "price-list", fileName: "Wholesale_Price_List.pdf" },
    { id: "sample-sheet", fileName: "Sample_Information_Sheet.pdf" },
  ];
}
