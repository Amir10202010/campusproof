import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { LIMITS } from "@/lib/config/limits";
import { env } from "@/lib/env";
import type { KnowFact } from "./whatToKnow";

/**
 * Step 2 of "На что посмотреть" (owner: P1 · community feature, Этап 4): Gemini gets ONLY the fact list
 * from whatToKnow.ts and rewrites it into 4-6 RU sentences. It never adds a fact, never evaluates the
 * university, and writes "данных нет" where a point has nothing behind it. Code validates every sentence
 * cites an existing fact index; anything else is dropped. Model unavailable → caller shows the plain list.
 */
export interface KnowSentence {
  text: string;
  sourceLabel: string;
  sourceUrl?: string;
}

const SYSTEM_PROMPT = `Ты переписываешь список фактов об университете в связный текст для абитуриента на русском языке.
Правила (обязательны):
- Используй ИСКЛЮЧИТЕЛЬНО факты из пронумерованного списка. Не добавляй ничего от себя: ни оценок, ни советов, ни выводов.
- Не оценивай университет и не пиши "чего опасаться" — только нейтрально излагай факты.
- Если по какому-то пункту фактов не хватает, явно напиши, что данных нет — не додумывай.
- 4-6 коротких предложений. Каждое предложение — укажи номер факта, на котором оно основано.
- Верни только JSON по схеме.`;

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    sentences: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        properties: { text: { type: "string" }, factIndex: { type: "integer" } },
        required: ["text", "factIndex"],
      },
    },
  },
  required: ["sentences"],
};

const modelOutput = z.object({
  sentences: z.array(z.object({ text: z.string(), factIndex: z.number().int() })),
});

export async function rewriteFacts(facts: KnowFact[], signal: AbortSignal): Promise<KnowSentence[] | null> {
  if (facts.length === 0 || !env.geminiApiKey) return null;
  const prompt = facts.map((f, i) => `[${i}] ${f.text}`).join("\n");

  try {
    const response = await new GoogleGenAI({ apiKey: env.geminiApiKey }).models.generateContent({
      model: env.descriptionModel,
      contents: prompt,
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseJsonSchema: OUTPUT_SCHEMA,
        temperature: 0.1,
        maxOutputTokens: 1024,
        abortSignal: AbortSignal.any([signal, AbortSignal.timeout(LIMITS.DESCRIPTION_TIMEOUT_MS)]),
      },
    });
    const parsed = modelOutput.parse(JSON.parse(response.text ?? ""));
    const sentences = parsed.sentences
      .filter((s) => s.factIndex >= 0 && s.factIndex < facts.length && s.text.trim())
      .map((s) => ({
        text: s.text.trim(),
        sourceLabel: facts[s.factIndex].sourceLabel,
        sourceUrl: facts[s.factIndex].sourceUrl,
      }));
    return sentences.length > 0 ? sentences : null;
  } catch {
    return null;
  }
}
