import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WikipediaSummary } from "@/lib/types";

/** Gemini SDK and env are mocked: tests never call the real (quota-limited) API. */
const gemini = vi.hoisted(() => ({
  generateContent: vi.fn(),
  apiKey: "test-key" as string | undefined,
  /** GEMINI_API_KEY may hold several comma-separated keys (lib/env.ts); the description rotates over them. */
  keys: ["test-key"] as string[],
}));
vi.mock("@google/genai", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@google/genai")>();
  return {
    ...actual,
    GoogleGenAI: class {
      models = { generateContent: gemini.generateContent };
    },
  };
});
vi.mock("@/lib/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/env")>();
  return {
    ...actual,
    env: new Proxy(actual.env, {
      get: (target, key) => {
        if (key === "geminiApiKey") return gemini.apiKey;
        if (key === "geminiApiKeys") return gemini.keys;
        return Reflect.get(target, key);
      },
    }),
  };
});
vi.mock("@/lib/cache/kv", () => ({ kvGet: async () => null, kvSet: async () => {}, getRedis: () => null }));

const { ApiError } = await import("@google/genai");
const { assembleDescription, buildSources, describeCampus, splitSentences, wikipediaQuote } =
  await import("@/lib/describe/description");

const ru: WikipediaSummary = {
  lang: "ru",
  title: "Назарбаев Университет",
  url: "https://ru.wikipedia.org/wiki/Назарбаев_Университет",
  extract:
    "Назарбаев Университет (НУ) (каз. Назарбаев Университеті) — высшее учебное заведение в Астане. Основан в 2010 году по инициативе К. И. Иванова. Обучение ведётся на английском языке. Кампус расположен на левом берегу.",
};
const en: WikipediaSummary = {
  lang: "en",
  title: "Nazarbayev University",
  url: "https://en.wikipedia.org/wiki/Nazarbayev_University",
  extract: "Nazarbayev University is an autonomous research university in Astana, Kazakhstan.",
};
const input = {
  entity: {
    qid: "Q2783344",
    name: "Назарбаев Университет",
    names: {},
    aliases: [],
    country: "Казахстан",
    countryCode: "KZ",
    domains: [],
    wikipedia: [],
  },
  summaries: [ru, en],
  facts: [{ label: "Основан", value: "2009", sourceUrl: "https://www.wikidata.org/wiki/Q2783344#P571" }],
  aiAllowed: true,
};
const signal = () => new AbortController().signal;

beforeEach(() => {
  gemini.generateContent.mockReset();
  gemini.apiKey = "test-key";
  gemini.keys = ["test-key"];
});

describe("describeCampus", () => {
  it("builds cited text from Gemini JSON and keeps only cited sources", async () => {
    gemini.generateContent.mockResolvedValue({
      text: JSON.stringify({
        sentences: [
          { text: "Назарбаев Университет — вуз в Астане.", sources: [1, 2] },
          { text: "Основан в 2009 году.", sources: [3] },
          { text: "Выдуманный факт без источника.", sources: [9] },
        ],
      }),
    });
    const description = await describeCampus(input, signal());
    expect(description?.text).toBe("Назарбаев Университет — вуз в Астане. [1][2] Основан в 2009 году. [3]");
    expect(description?.citations.map((c) => c.n)).toEqual([1, 2, 3]);
    expect(description?.citations[2]).toMatchObject({ url: "https://www.wikidata.org/wiki/Q2783344" });

    const request = gemini.generateContent.mock.calls[0][0];
    expect(request.model).toBeTruthy();
    expect(request.contents).toContain("[1] Википедия (ru): Назарбаев Университет");
    expect(request.contents).toContain("[3] Wikidata: Назарбаев Университет\nОснован: 2009");
    expect(request.config).toMatchObject({ responseMimeType: "application/json", temperature: 0.2 });
    expect(request.config.abortSignal).toBeInstanceOf(AbortSignal);
  });

  it("never calls Gemini when AI is not allowed for the visitor's region", async () => {
    const description = await describeCampus({ ...input, aiAllowed: false }, signal());
    expect(gemini.generateContent).not.toHaveBeenCalled();
    expect(description?.citations).toEqual([expect.objectContaining({ n: 1, url: ru.url })]);
  });

  it("falls back to the Wikipedia quote without a key, on quota errors and on invalid output", async () => {
    gemini.apiKey = undefined;
    gemini.keys = [];
    expect((await describeCampus(input, signal()))?.text).toMatch(/\[1\]$/);
    expect(gemini.generateContent).not.toHaveBeenCalled();

    gemini.apiKey = "test-key";
    gemini.keys = ["test-key"];
    gemini.generateContent.mockRejectedValueOnce(new ApiError({ message: "quota", status: 429 }));
    expect((await describeCampus(input, signal()))?.citations[0].url).toBe(ru.url);

    gemini.generateContent.mockResolvedValueOnce({ text: "not json" });
    expect((await describeCampus(input, signal()))?.citations[0].url).toBe(ru.url);
  });

  it("moves to the spare key when the first one is spent, but not on a model error", async () => {
    gemini.keys = ["spent-key", "spare-key"];
    gemini.generateContent
      .mockRejectedValueOnce(new ApiError({ message: "quota", status: 429 }))
      .mockResolvedValueOnce({
        text: JSON.stringify({ sentences: [{ text: "Вуз в Астане.", sources: [1] }] }),
      });
    expect((await describeCampus(input, signal()))?.text).toBe("Вуз в Астане. [1]");
    expect(gemini.generateContent).toHaveBeenCalledTimes(2);

    // A 500 is the model's problem, not the key's: spending a second key on it would be waste.
    gemini.generateContent.mockReset();
    gemini.generateContent.mockRejectedValue(new ApiError({ message: "boom", status: 500 }));
    expect((await describeCampus(input, signal()))?.citations[0].url).toBe(ru.url);
    expect(gemini.generateContent).toHaveBeenCalledTimes(1);
  });

  it("returns null without any sources", async () => {
    expect(await describeCampus({ ...input, summaries: [], facts: [] }, signal())).toBeNull();
  });
});

describe("description helpers", () => {
  it("numbers Wikipedia intros first, then Wikidata facts", () => {
    expect(buildSources(input).map((s) => `${s.n} ${s.title}`)).toEqual([
      "1 Википедия (ru): Назарбаев Университет",
      "2 Википедия (en): Nazarbayev University",
      "3 Wikidata: Назарбаев Университет",
    ]);
  });

  it("strips markers the model put into the text and rejects ungrounded output", () => {
    const sources = buildSources(input);
    expect(
      assembleDescription(JSON.stringify({ sentences: [{ text: "Вуз в Астане [1].", sources: [1] }] }), sources)?.text,
    ).toBe("Вуз в Астане. [1]");
    expect(
      assembleDescription(JSON.stringify({ sentences: [{ text: "Без источников", sources: [7] }] }), sources),
    ).toBeNull();
  });

  it("quotes 2–3 sentences of the ru intro without breaking on initials and abbreviations", () => {
    expect(splitSentences(ru.extract)).toHaveLength(4);
    const quote = wikipediaQuote([en, ru]);
    expect(quote?.text).toBe(
      "Назарбаев Университет (НУ) (каз. Назарбаев Университеті) — высшее учебное заведение в Астане. Основан в 2010 году по инициативе К. И. Иванова. Обучение ведётся на английском языке. [1]",
    );
    expect(wikipediaQuote([])).toBeNull();
  });
});
