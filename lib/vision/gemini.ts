import { env } from "@/lib/env";
import type { VisionContext, VisionProvider } from "./provider";
import { VISION_OUTPUT_JSON_SCHEMA, VISION_SYSTEM_PROMPT } from "./prompt";
import { parseVisionObservations } from "./schema";

/**
 * P2 · issue #18 · FREE tier Google Gemini over plain REST with the `x-goog-api-key` header.
 *
 * Deliberately NOT the SDK: when it cannot see an API key it silently falls back to Google OAuth
 * (Application Default Credentials), and on Vercel that produced a confusing
 * "401 ACCESS_TOKEN_TYPE_UNSUPPORTED" instead of a plain "no key". Here a missing key fails loudly
 * and any API error is passed through verbatim, so the logs say what is actually wrong.
 *
 * The model only reports what it sees; tiers and points are decided by lib/scoring.
 * Model id comes from env.visionModel (chosen by spike S4, #22) — never hard-code it.
 */
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

export function createGeminiVisionProvider(): VisionProvider {
  return {
    async observe(items, context, signal) {
      const apiKey = env.geminiApiKey;
      if (!apiKey) throw new Error("Визуальная проверка не настроена: нет ключа GEMINI_API_KEY");
      if (items.length === 0) return [];

      const parts: GeminiPart[] = [{ text: contextBlock(context) }];
      for (const item of items) {
        parts.push({ text: `Image ${item.id}: ${item.meta}` });
        parts.push({ inlineData: { mimeType: "image/jpeg", data: item.jpeg.toString("base64") } });
      }

      const response = await fetch(`${ENDPOINT}/${env.visionModel}:generateContent`, {
        method: "POST",
        signal,
        headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: VISION_SYSTEM_PROMPT }] },
          contents: [{ role: "user", parts }],
          // Only responseMimeType: a strict schema is rejected by some free models, and
          // lib/vision/schema.ts validates the answer anyway.
          generationConfig: { temperature: 0, responseMimeType: "application/json" },
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini ${response.status}: ${(await response.text()).replace(/\s+/g, " ").slice(0, 300)}`);
      }

      const body = (await response.json()) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const text = (body.candidates?.[0]?.content?.parts ?? [])
        .map((part) => part.text ?? "")
        .join("")
        .trim();
      if (!text) throw new Error("Vision-модель вернула пустой ответ");
      return parseVisionObservations(text);
    },
  };
}

/** What the model needs to tell "this university" from any other one, plus the answer format. */
export function contextBlock(context: VisionContext): string {
  const { entity } = context;
  const names = [entity.names.en, entity.names.ru, entity.names.kk, ...entity.aliases].filter(Boolean);
  const lines = [
    "University to check the images against:",
    `- Names: ${[...new Set(names)].join(" | ")}`,
    `- Location: ${[entity.city?.name, entity.country].filter(Boolean).join(", ")}`,
  ];
  if (entity.domains.length > 0) lines.push(`- Official site: ${entity.domains.join(", ")}`);
  if (context.subcategories.length > 0) {
    lines.push(`- Known places on campus: ${context.subcategories.slice(0, 10).join("; ")}`);
  }
  if (context.wikipediaExtract) lines.push(`- Background: ${context.wikipediaExtract.slice(0, 600)}`);
  lines.push(
    "Each image below comes with an id line. Report one entry per image, using exactly those ids.",
    `Answer with JSON only, matching this schema:\n${VISION_OUTPUT_JSON_SCHEMA}`,
  );
  return lines.join("\n");
}
