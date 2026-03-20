import type { AttachmentOption } from "@/features/attachments/types";

export async function fetchAttachmentOptions(): Promise<AttachmentOption[]> {
  return [
    {
      id: "brochure",
      label: "Axel Brochure",
      url: "https://axelselixir.com/pages/axel-brochure-coming-soon",
    },
    {
      id: "price-list",
      label: "Wholesale Price List",
      url: "https://axelselixir.com/pages/wholesale-price-list-coming-soon",
    },
    {
      id: "sample-sheet",
      label: "Sample Information Sheet",
      url: "https://axelselixir.com/pages/sample-information-coming-soon",
    },
  ];
}
