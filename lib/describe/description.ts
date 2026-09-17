import { createHash } from "node:crypto";
import { ApiError, GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { kvGet, kvSet } from "@/lib/cache/kv";
import { LIMITS } from "@/lib/config/limits";
import { env } from "@/lib/env";
import type { Description, ProfileFact, UniversityEntity, WikipediaSummary } from "@/lib/types";

export interface DescribeInput {
  entity: UniversityEntity;
  summaries: WikipediaSummary[];
  facts: ProfileFact[];
  /** false → never call Gemini (visitor region, see lib/pipeline/regions.ts): use the Wikipedia fallback. */
  aiAllowed: boolean;
}

/**
 * P1 · issue #20 · FREE: Gemini (`env.descriptionModel`, SDK `@google/genai`) gets the numbered sources
 * (Wikipedia extracts + Wikidata facts) and returns JSON `{ sentences: [{ text, sources: [n, …] }] }`.
 * Code validates that every sentence cites existing sources, builds `text` with [n] markers + `citations`.
 * 3–5 RU sentences for applicants, only from the sources. No sources → null.
 * !aiAllowed / no key / model error / quota → fallback: quote 2–3 sentences of the ru (else en) Wikipedia extract as [1].
 */
export type DescribeCampus = (input: DescribeInput, signal: AbortSignal) => Promise<Description | null>;

export const describeCampus: DescribeCampus = async (input, signal) => {
  const sources = buildSources(input);
  if (sources.length === 0) return null;

  if (input.aiAllowed && env.geminiApiKey) {
    try {
      const described = await describeWithGemini(input.entity, sources, signal);
      if (described) return described;
    } catch (error) {
      const quota = error instanceof ApiError && error.status === 429;
      console.error(
        JSON.stringify({
          at: "describeCampus",
          qid: input.entity.qid,
          error: quota ? "gemini_quota" : error instanceof Error ? error.message : String(error),
        }),
      );
    }
  }
  return wikipediaQuote(input.summaries);
};

export interface NumberedSource {
  n: number;
  url: string;
  title: string;
  text: string;
}

/** [1..k] Wikipedia intros (ru first), then [k+1] Wikidata facts. */
export function buildSources({ entity, summaries, facts }: DescribeInput): NumberedSource[] {
  const sources: NumberedSource[] = summaries
    .filter((s) => s.extract.trim())
    .map((s, i) => ({ n: i + 1, url: s.url, title: `Википедия (${s.lang}): ${s.title}`, text: s.extract }));
  if (facts.length > 0) {
    sources.push({
      n: sources.length + 1,
      url: `https://www.wikidata.org/wiki/${entity.qid}`,
      title: `Wikidata: ${entity.name}`,
      text: facts.map((f) => `${f.label}: ${f.value}`).join("\n"),
    });
  }
  return sources;
}

const SYSTEM_PROMPT = `Ты пишешь краткое нейтральное описание университета для абитуриентов на русском языке.
Правила:
- Используй только факты из пронумерованных источников. Ничего не додумывай: никаких рейтингов, оценок, цифр и событий, которых нет в источниках.
- 3–5 коротких предложений: что это за университет, где находится, когда основан, чем известен; о кампусе — только если об этом есть в источниках.
- У каждого предложения укажи номера источников, из которых взяты его факты.
- Без рекламных формулировок и без обращения к читателю.
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
        properties: {
          text: { type: "string" },
          sources: { type: "array", minItems: 1, items: { type: "integer" } },
        },
        required: ["text", "sources"],
      },
    },
  },
  required: ["sentences"],
};

const modelOutput = z.object({
  sentences: z.array(z.object({ text: z.string(), sources: z.array(z.number().int()) })),
});

const MAX_SENTENCES = 5;

async function describeWithGemini(
  entity: UniversityEntity,
  sources: NumberedSource[],
  signal: AbortSignal,
): Promise<Description | null> {
  const model = env.descriptionModel;
  const cacheKey = `describe:v1:${model}:${entity.qid}:${createHash("sha1")
    .update(JSON.stringify(sources))
    .digest("hex")}`;
  const cached = await kvGet<Description>(cacheKey);
  if (cached) return cached;

  const place = [entity.city?.name, entity.country].filter(Boolean).join(", ");
  const prompt = [
    `Университет: ${entity.name}${place ? ` (${place})` : ""}`,
    "",
    "Источники:",
    ...sources.map((s) => `[${s.n}] ${s.title}\n${s.text}`),
  ].join("\n");

  const response = await new GoogleGenAI({ apiKey: env.geminiApiKey }).models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: SYSTEM_PROMPT,
      responseMimeType: "application/json",
      responseJsonSchema: OUTPUT_SCHEMA,
      temperature: 0.2,
      maxOutputTokens: 1024,
      // 2.5 Flash thinks by default; a grounded 5-sentence summary does not need it (latency + free quota).
      ...(/2\.5-flash/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
      abortSignal: AbortSignal.any([signal, AbortSignal.timeout(LIMITS.DESCRIPTION_TIMEOUT_MS)]),
    },
  });

  const description = assembleDescription(response.text ?? "", sources);
  if (description) await kvSet(cacheKey, description, LIMITS.PROFILE_CACHE_TTL_S);
  return description;
}

/**
 * Validates the model JSON: keeps sentences that cite existing sources only, max 5.
 * Text gets [n] markers; citations list only the sources actually cited. Nothing valid → null.
 */
export function assembleDescription(raw: string, sources: NumberedSource[]): Description | null {
  let parsed: z.infer<typeof modelOutput>;
  try {
    parsed = modelOutput.parse(JSON.parse(raw));
  } catch {
    return null;
  }
  const byNumber = new Map(sources.map((s) => [s.n, s]));
  const sentences = parsed.sentences
    .map((s) => ({
      text: s.text.replace(/\s*\[\d+(?:\s*,\s*\d+)*\]/g, "").trim(),
      sources: [...new Set(s.sources.filter((n) => byNumber.has(n)))].sort((a, b) => a - b),
    }))
    .filter((s) => s.text && s.sources.length > 0)
    .slice(0, MAX_SENTENCES);
  if (sentences.length === 0) return null;

  const cited = [...new Set(sentences.flatMap((s) => s.sources))].sort((a, b) => a - b);
  return {
    text: sentences.map((s) => `${s.text} ${s.sources.map((n) => `[${n}]`).join("")}`).join(" "),
    citations: cited.map((n) => {
      const source = byNumber.get(n) as NumberedSource;
      return { n, url: source.url, title: source.title };
    }),
  };
}

/** Fallback without AI: the first 2–3 sentences of the ru (else en) Wikipedia intro, quoted as [1]. */
export function wikipediaQuote(summaries: WikipediaSummary[]): Description | null {
  const summary = summaries.find((s) => s.lang === "ru" && s.extract.trim()) ?? summaries.find((s) => s.extract.trim());
  if (!summary) return null;
  const sentences = splitSentences(summary.extract);
  let quote = sentences.slice(0, 2).join(" ");
  if (sentences.length > 2 && quote.length < 220) quote = sentences.slice(0, 3).join(" ");
  return {
    text: `${quote} [1]`,
    citations: [{ n: 1, url: summary.url, title: `Википедия (${summary.lang}): ${summary.title}`, quote: undefined }],
  };
}

/** Initials ("К. И. Сатпаева") and common abbreviations ("каз.", "им.", "г.") do not end a sentence. */
const ABBREVIATION =
  /(?:^|[\s(])(?:\p{Lu}|каз|англ|рус|лат|нем|фр|им|г|гг|ул|пр|просп|т|д|св|акад|проф|доц|см|ок|род|тыс|млн|млрд|напр|e\.g|i\.e|etc|Dr|Mr|Mrs|Ms|St|Prof|Jr|Sr|Inc|Ltd|No|vs|approx|est)$/u;

export function splitSentences(text: string): string[] {
  const sentences: string[] = [];
  let start = 0;
  for (const match of text.matchAll(/[.!?…]+(?=\s+[\p{Lu}\d«"(])/gu)) {
    const end = (match.index ?? 0) + match[0].length;
    const before = text.slice(start, match.index);
    if (ABBREVIATION.test(before)) continue;
    sentences.push(text.slice(start, end).trim());
    start = end;
  }
  const tail = text.slice(start).trim();
  if (tail) sentences.push(tail);
  return sentences;
}
