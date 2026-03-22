import { NextResponse } from "next/server";
import { z } from "zod";

const extractedBusinessCardSchema = z.object({
  shopName: z.string().default(""),
  contactName: z.string().default(""),
  phoneNumber: z.string().default(""),
  email: z.string().default(""),
  addressLine1: z.string().default(""),
  addressLine2: z.string().default(""),
  addressLine3: z.string().default(""),
  townCity: z.string().default(""),
  countyRegion: z.string().default(""),
  postcode: z.string().default(""),
  website: z.string().default(""),
  notes: z.string().default(""),
  rawText: z.string().default(""),
});

function extractJsonObject(text: string) {
  const fencedMatch = text.match(/```json\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");

  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return text.trim();
  }

  return text.slice(firstBrace, lastBrace + 1).trim();
}

function extractOutputText(payload: {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const chunks =
    payload.output
      ?.flatMap((item) => item.content ?? [])
      .map((item) => {
        if (typeof item.text === "string") {
          return item.text;
        }
        return "";
      })
      .filter(Boolean) ?? [];

  return chunks.join("\n").trim();
}

export async function POST(request: Request) {
  const openAiApiKey = process.env.OPENAI_API_KEY;

  if (!openAiApiKey) {
    return NextResponse.json(
      { error: "Missing OpenAI API key." },
      { status: 500 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "No business card image was provided." },
      { status: 400 }
    );
  }

  const bytes = await file.arrayBuffer();
  const base64Image = Buffer.from(bytes).toString("base64");
  const mimeType = file.type || "image/jpeg";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openAiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Read this business card image and extract the lead details. Return only valid JSON with these exact keys: shopName, contactName, phoneNumber, email, addressLine1, addressLine2, addressLine3, townCity, countyRegion, postcode, website, notes, rawText. Use empty strings where unknown. Put your best plain-text OCR reading of the card into rawText. notes should briefly mention this was captured from a business card and any useful extra context spotted on the card.",
            },
            {
              type: "input_image",
              image_url: `data:${mimeType};base64,${base64Image}`,
            },
          ],
        },
      ],
    }),
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        output_text?: string;
        output?: Array<{
          content?: Array<{
            type?: string;
            text?: string;
          }>;
        }>;
        error?: { message?: string };
      }
    | null;

  if (!response.ok) {
    return NextResponse.json(
      { error: payload?.error?.message ?? "OpenAI business card extraction failed." },
      { status: 500 }
    );
  }

  const outputText = payload ? extractOutputText(payload) : "";

  try {
    const parsed = JSON.parse(extractJsonObject(outputText));
    const extracted = extractedBusinessCardSchema.parse(parsed);
    return NextResponse.json({ extracted });
  } catch {
    return NextResponse.json(
      { error: "OpenAI returned an unreadable extraction result." },
      { status: 500 }
    );
  }
}
