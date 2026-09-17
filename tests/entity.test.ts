import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import recorded from "@/tests/data/wikidata-entities.json";
import { replayFetch } from "@/tests/helpers/replayFetch";
import { clearWikidataMemo, getEntity } from "@/lib/sources/wikidata";
import { clipExtract, getSummaries } from "@/lib/sources/wikipedia";

/** Real Wikidata/Wikipedia responses recorded on 17 Sep 2026 for five Kazakhstan universities. */
let calls: ReturnType<typeof replayFetch>;
beforeEach(() => {
  clearWikidataMemo();
  calls = replayFetch(recorded as Record<string, unknown>);
});
afterEach(() => vi.unstubAllGlobals());

const signal = () => new AbortController().signal;
const KZ_UNIVERSITIES = ["Q2783344", "Q1734762", "Q427677", "Q1513804", "Q127745"];

describe("getEntity", () => {
  it.each(KZ_UNIVERSITIES)(
    "%s has coordinates, a Commons category and a city within 3–4 Wikimedia calls",
    async (qid) => {
      const { entity, facts } = await getEntity(qid, signal());
      expect(entity).toMatchObject({ qid, countryCode: "KZ", country: "Казахстан" });
      expect(entity.coords).toEqual({ lat: expect.any(Number), lon: expect.any(Number) });
      expect(entity.commonsCategory).toBeTruthy();
      expect(entity.city).toMatchObject({ name: expect.any(String), lat: expect.any(Number), lon: expect.any(Number) });
      expect(entity.domains.length).toBeGreaterThan(0);
      expect(facts.find((f) => f.label === "Основан")?.sourceUrl).toBe(`https://www.wikidata.org/wiki/${qid}#P571`);
      // 3 calls: item, city+country, ISO code; +1 only when the item has no P625 (article coordinates).
      expect(calls.length).toBeLessThanOrEqual(entity.coords ? 4 : 3);
    },
  );

  it("builds RU facts with sources for Nazarbayev University", async () => {
    const { entity, facts } = await getEntity("Q2783344", signal());
    expect(entity.name).toBe("Назарбаев Университет");
    expect(entity.wikipedia.map((w) => w.lang)).toEqual(["ru", "en", "kk"]);
    expect(facts.map((f) => f.label)).toEqual(["Основан", "Студентов", "Город", "Страна", "Сайт"]);
    expect(facts.find((f) => f.label === "Город")).toMatchObject({ value: "Астана" });
    expect(calls).toHaveLength(3);
  });

  it("falls back to the Wikipedia article coordinates when the item has none", async () => {
    const { entity } = await getEntity("Q427677", signal());
    expect(entity.coords).toEqual({ lat: 43.225, lon: 76.92111 });
    expect(calls.some((c) => c.url.startsWith("https://ru.wikipedia.org/"))).toBe(true);
  });

  it("reuses memoized items: a second read makes no calls", async () => {
    await getEntity("Q1734762", signal());
    const before = calls.length;
    await getEntity("Q1734762", signal());
    expect(calls.length).toBe(before);
  });

  it("throws for an unknown item so the pipeline reports an error", async () => {
    await expect(getEntity("Q999999999999", signal())).rejects.toThrow();
  });
});

describe("getSummaries", () => {
  it("returns the ru intro first, then en, with canonical URLs", async () => {
    const { entity } = await getEntity("Q2783344", signal());
    const summaries = await getSummaries(entity, signal());
    expect(summaries.map((s) => s.lang)).toEqual(["ru", "en"]);
    expect(summaries[0].url).toMatch(/^https:\/\/ru\.wikipedia\.org\/wiki\//);
    expect(summaries[0].extract).toContain("Назарбаев Университет");
  });

  it("returns nothing for an entity without articles", async () => {
    const { entity } = await getEntity("Q2783344", signal());
    expect(await getSummaries({ ...entity, wikipedia: [] }, signal())).toEqual([]);
  });

  it("throws when every language fails", async () => {
    const { entity } = await getEntity("Q2783344", signal());
    vi.stubGlobal("fetch", async () => new Response("down", { status: 503 }));
    await expect(getSummaries(entity, signal())).rejects.toThrow(/Wikimedia API/);
  });
});

describe("clipExtract", () => {
  it("cleans empty template brackets and whitespace", () => {
    expect(clipExtract("Университет ( ) —  вуз\n\nв Астане .")).toBe("Университет — вуз в Астане.");
  });

  it("cuts long text at a sentence end", () => {
    const text = `${"Первое предложение. ".repeat(10)}Хвост без точки`;
    const clipped = clipExtract(text, 100);
    expect(clipped.length).toBeLessThanOrEqual(100);
    expect(clipped.endsWith(".")).toBe(true);
  });
});
