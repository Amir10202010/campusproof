import { z } from "zod";
import universities from "@/data/universities.min.json";
import { LIMITS } from "@/lib/config/limits";
import { env } from "@/lib/env";

/**
 * Онбординг (owner: P1 · community feature, Этап 3): абитуриент описывает словами, чего хочет от вуза,
 * Gemini ВЫБИРАЕТ подходящие из нашего каталога и коротко объясняет выбор. Модель не может выдумать вуз:
 * она возвращает только qid, и код оставляет лишь те, что есть в data/universities.min.json.
 * Выбранный вуз дальше уходит в обычный поиск — профиль собирает тот же пайплайн, что и всегда.
 */
export interface Suggestion {
  qid: string;
  name: string;
  city?: string;
  country: string;
  reason: string;
}

interface Row {
  qid: string;
  names: { en?: string; ru?: string; kk?: string };
  city?: string;
  country: string;
}

const CATALOGUE = (universities as Row[]).map((row) => ({
  qid: row.qid,
  name: row.names.ru ?? row.names.en ?? row.qid,
  city: row.city,
  country: row.country,
}));

const BY_QID = new Map(CATALOGUE.map((row) => [row.qid, row]));

const SYSTEM_PROMPT = `Ты помогаешь абитуриенту выбрать университет из закрытого каталога.
Правила (обязательны):
- Выбирай ТОЛЬКО из переданного списка и возвращай qid ровно в том виде, как он записан в списке.
- Никогда не придумывай университеты, которых нет в списке.
- Верни от 1 до 5 вариантов, самый подходящий первым.
- Для каждого напиши reason — одно короткое предложение на русском о том, чем он подходит ИМЕННО под запрос
  (город, страна, направление, язык). Не выдумывай фактов о вузе: опирайся на запрос и на строку каталога.
- Если запрос слишком общий, всё равно предложи разумные варианты и скажи в reason, по какому признаку выбрал.
- Верни только JSON по схеме.`;

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

const OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    picks: {
      type: "array",
      minItems: 1,
      maxItems: 5,
      items: {
        type: "object",
        properties: { qid: { type: "string" }, reason: { type: "string" } },
        required: ["qid", "reason"],
      },
    },
  },
  required: ["picks"],
};

const modelOutput = z.object({ picks: z.array(z.object({ qid: z.string(), reason: z.string() })) });

/** `null` — модель недоступна или ответила мусором; вызывающий показывает честную ошибку, а не пустой список. */
export async function suggestUniversities(
  request: string,
  signal: AbortSignal,
): Promise<{ picks: Suggestion[] | null; detail?: string }> {
  if (!request.trim() || !env.geminiApiKey) return { picks: null, detail: "нет ключа" };

  const catalogue = CATALOGUE.map((row) => `${row.qid}|${row.name}|${row.city ?? "—"}|${row.country}`).join("\n");
  const prompt = `Запрос абитуриента:\n${request.trim().slice(0, 600)}\n\nКаталог (qid|название|город|страна):\n${catalogue}`;

  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: OUTPUT_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 1024,
    },
  });

  try {
    // Тот же путь, что и в lib/vision/gemini.ts: REST с x-goog-api-key. SDK на Vercel не видит ключ.
    const response = await fetch(`${ENDPOINT}/${env.descriptionModel}:generateContent`, {
      method: "POST",
      signal: AbortSignal.any([signal, AbortSignal.timeout(LIMITS.DESCRIPTION_TIMEOUT_MS)]),
      headers: { "content-type": "application/json", "x-goog-api-key": env.geminiApiKey },
      body,
    });
    if (!response.ok) {
      return {
        picks: null,
        detail: `Gemini ${response.status}: ${(await response.text()).replace(/\s+/g, " ").slice(0, 200)}`,
      };
    }
    const answer = (await response.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    const text = (answer.candidates?.[0]?.content?.parts ?? [])
      .map((part) => part.text ?? "")
      .join("")
      .trim();
    const parsed = modelOutput.parse(JSON.parse(text));
    const seen = new Set<string>();
    const picks: Suggestion[] = [];
    for (const pick of parsed.picks) {
      const row = BY_QID.get(pick.qid.trim());
      if (!row || seen.has(row.qid) || !pick.reason.trim()) continue;
      seen.add(row.qid);
      picks.push({ ...row, reason: pick.reason.trim().slice(0, 200) });
    }
    return picks.length > 0 ? { picks } : { picks: null, detail: "модель не выбрала ни одного вуза из каталога" };
  } catch (error) {
    return { picks: null, detail: String(error).replace(/\s+/g, " ").slice(0, 200) };
  }
}
