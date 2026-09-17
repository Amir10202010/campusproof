import { GoogleGenAI, type Part } from "@google/genai";
import { env } from "@/lib/env";
import type { VisionContext, VisionProvider } from "./provider";
import { VISION_OUTPUT_JSON_SCHEMA, VISION_SYSTEM_PROMPT } from "./prompt";
import { parseVisionObservations } from "./schema";

/**
 * P2 · issue #18 · FREE tier Google Gemini via the official SDK `@google/genai`.
 * The model only reports what it sees; tiers and points are decided by lib/scoring.
 * Model id comes from env.visionModel (chosen by spike S4, #22) — never hard-code it.
 * Note: `mediaResolution` (Gemini 3) would cut tokens further; left at the default so every free model accepts the call.
 */
export function createGeminiVisionProvider(): VisionProvider {
  let client: GoogleGenAI | undefined;

  return {
    async observe(items, context, signal) {
      if (!env.geminiApiKey) throw new Error("Визуальная проверка не настроена: нет ключа GEMINI_API_KEY");
      if (items.length === 0) return [];
      client ??= new GoogleGenAI({ apiKey: env.geminiApiKey });

      const parts: Part[] = [{ text: contextBlock(context) }];
      for (const item of items) {
        parts.push({ text: `Image ${item.id}: ${item.meta}` });
        parts.push({ inlineData: { mimeType: "image/jpeg", data: item.jpeg.toString("base64") } });
      }

      const response = await client.models.generateContent({
        model: env.visionModel,
        contents: [{ role: "user", parts }],
        config: {
          systemInstruction: VISION_SYSTEM_PROMPT,
          responseMimeType: "application/json",
          responseJsonSchema: JSON.parse(VISION_OUTPUT_JSON_SCHEMA),
          temperature: 0,
          abortSignal: signal,
        },
      });

      const text = response.text;
      if (!text) throw new Error("Vision-модель вернула пустой ответ");
      return parseVisionObservations(text);
    },
  };
}

/** What the model needs to tell "this university" from any other one. */
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
  lines.push("Each image below comes with an id line. Report one entry per image, using exactly those ids.");
  return lines.join("\n");
}
