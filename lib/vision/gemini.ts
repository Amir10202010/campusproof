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
  // Remembered for the lifetime of the instance: discovery costs one extra call, not one per batch.
  let working: string | undefined;
  // Spare keys exist for a revoked or blocked key, never to get around a spent quota.
  let keyIndex = 0;

  return {
    async observe(items, context, signal) {
      if (env.geminiApiKeys.length === 0) throw new Error("Визуальная проверка не настроена: нет ключа GEMINI_API_KEY");
      const apiKey = env.geminiApiKeys[keyIndex] ?? env.geminiApiKeys[0];
      if (items.length === 0) return [];

      const parts: GeminiPart[] = [{ text: contextBlock(context) }];
      for (const item of items) {
        parts.push({ text: `Image ${item.id}: ${item.meta}` });
        parts.push({ inlineData: { mimeType: "image/jpeg", data: item.jpeg.toString("base64") } });
      }

      const body = JSON.stringify({
        systemInstruction: { parts: [{ text: VISION_SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts }],
        // Only responseMimeType: a strict schema is rejected by some free models, and
        // lib/vision/schema.ts validates the answer anyway.
        generationConfig: { temperature: 0, responseMimeType: "application/json" },
      });

      const text = await askModel(working ?? env.visionModel, body, apiKey, signal).catch(async (error: unknown) => {
        // A dead key (revoked, blocked, wrong project) costs one attempt on the next spare key.
        if (isKeyRejected(error) && keyIndex + 1 < env.geminiApiKeys.length) {
          keyIndex += 1;
          console.error(JSON.stringify({ at: "vision", switchedKey: keyIndex, after: String(error).slice(0, 160) }));
          return askModel(working ?? env.visionModel, body, env.geminiApiKeys[keyIndex], signal);
        }
        // The model can be overloaded (503) or retired for new keys (404). Rather than guessing a
        // replacement, ask the API which models this key may actually use and remember the answer.
        if (!isModelUnavailable(error)) throw error;
        for (const candidate of await usableModels(apiKey, signal)) {
          if (candidate === (working ?? env.visionModel)) continue;
          try {
            const answer = await askModel(candidate, body, apiKey, signal);
            working = candidate;
            console.error(JSON.stringify({ at: "vision", switchedTo: candidate, after: String(error).slice(0, 160) }));
            return answer;
          } catch (next) {
            if (!isModelUnavailable(next)) throw next;
          }
        }
        throw error;
      });

      return parseVisionObservations(text);
    },
  };
}

/** The key itself is refused: invalid, revoked or without access to this API. */
export function isKeyRejected(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /Gemini (?:400|401|403)\b|API key not valid|API_KEY_INVALID|PERMISSION_DENIED|SERVICE_DISABLED/i.test(text);
}

/** Models this key may actually call, best first: the configured fallback, then Flash-Lite, then Flash. */
export async function usableModels(apiKey: string, signal: AbortSignal): Promise<string[]> {
  try {
    const response = await fetch(ENDPOINT, { signal, headers: { "x-goog-api-key": apiKey } });
    if (!response.ok) return [env.visionModelFallback];
    const body = (await response.json()) as {
      models?: { name?: string; supportedGenerationMethods?: string[] }[];
    };
    return rankModels(body.models ?? []);
  } catch {
    return [env.visionModelFallback];
  }
}

export function rankModels(models: { name?: string; supportedGenerationMethods?: string[] }[]): string[] {
  const ids = models
    .filter((model) => (model.supportedGenerationMethods ?? []).includes("generateContent"))
    .map((model) => (model.name ?? "").replace(/^models\//, ""))
    .filter(
      (id) =>
        /^gemini-(?:[\d.]+-)?flash(?:-lite)?(?:-latest)?$/.test(id) &&
        !/preview|exp|thinking|image|tts|native-audio|transcribe/.test(id),
    );

  // Flash-Lite first (cheapest, least contended, sees images just as well); the "-latest" aliases
  // ahead of numbered models, because Google retires numbers but keeps the alias alive.
  const weight = (id: string) => (id.includes("flash-lite") ? 0 : 2) + (id.endsWith("-latest") ? 0 : 1);
  return [...new Set([env.visionModelFallback, ...ids])]
    .filter((id) => ids.includes(id) || id === env.visionModelFallback)
    .sort((a, b) => weight(a) - weight(b) || b.localeCompare(a));
}

/** A model can be overloaded or retired — both are worth one attempt on another model. */
export function isModelUnavailable(error: unknown): boolean {
  const text = error instanceof Error ? error.message : String(error);
  return /Gemini (?:503|404|500|502)\b|UNAVAILABLE|overloaded|high demand|no longer available/i.test(text);
}

async function askModel(model: string, body: string, apiKey: string, signal: AbortSignal): Promise<string> {
  const response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/json", "x-goog-api-key": apiKey },
    body,
  });
  if (!response.ok) {
    throw new Error(`Gemini ${response.status}: ${(await response.text()).replace(/\s+/g, " ").slice(0, 300)}`);
  }
  const answer = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = (answer.candidates?.[0]?.content?.parts ?? [])
    .map((part) => part.text ?? "")
    .join("")
    .trim();
  if (!text) throw new Error(`Модель ${model} вернула пустой ответ`);
  return text;
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
