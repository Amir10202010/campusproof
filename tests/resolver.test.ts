import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import recorded from "@/tests/data/wikidata-resolver.json";
import { replayFetch } from "@/tests/helpers/replayFetch";

// These tests cover the live Wikidata path: the local index (#14) is switched off (tests/index-search.test.ts covers it).
vi.mock("@/lib/resolver/indexSearch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/resolver/indexSearch")>()),
  searchIndex: () => [],
}));
import { decide, resolveQuery } from "@/lib/resolver/resolve";
import { interleave, isHigherEducation, matchQuality, searchWikidata } from "@/lib/resolver/wikidata";
import { clearWikidataMemo, type RawEntity } from "@/lib/sources/wikidata";

/** Replays real Wikidata responses recorded on 17 Sep 2026 (tests never call live APIs). */
let calls: ReturnType<typeof replayFetch>;

beforeEach(() => {
  clearWikidataMemo();
  calls = replayFetch(recorded as Record<string, unknown>);
});

afterEach(() => vi.unstubAllGlobals());

const signal = () => new AbortController().signal;

describe("resolveQuery (recorded Wikidata responses)", () => {
  it("resolves an unambiguous abbreviation to a full entity", async () => {
    const result = await resolveQuery("KBTU", signal());
    expect(result.status).toBe("resolved");
    if (result.status !== "resolved") return;
    expect(result.entity).toMatchObject({
      qid: "Q1734762",
      countryCode: "KZ",
      country: "Казахстан",
      domains: ["kbtu.kz"],
      city: { qid: "Q35493", name: "Алма-Ата" },
    });
    expect(result.entity.coords?.lat).toBeCloseTo(43.26, 1);
    expect(result.entity.wikipedia.map((w) => w.lang)).toEqual(["ru", "en", "kk"]);
    expect(calls.length).toBeLessThanOrEqual(6);
    expect(calls.every((c) => c.userAgent?.startsWith("CampusProof/"))).toBe(true);
  });

  it("returns a pick-list for an abbreviation shared by several universities", async () => {
    const result = await resolveQuery("MSU", signal());
    expect(result.status).toBe("ambiguous");
    if (result.status !== "ambiguous") return;
    expect(result.candidates.length).toBeGreaterThan(1);
    expect(result.candidates.length).toBeLessThanOrEqual(6);
    expect(result.candidates.map((c) => c.qid)).toEqual(expect.arrayContaining(["Q13164", "Q270222"]));
    expect(result.candidates.find((c) => c.qid === "Q13164")).toMatchObject({ city: "Москва", country: "Россия" });
  });

  it("finds a university by a surname in its full name through full-text search", async () => {
    const result = await resolveQuery("Satpaev", signal());
    expect(result).toMatchObject({ status: "resolved", entity: { qid: "Q1513804", countryCode: "KZ" } });
  });

  it("answers not_found for gibberish", async () => {
    expect(await resolveQuery("asdfgh", signal())).toEqual({ status: "not_found", query: "asdfgh", suggestions: [] });
  });

  it("answers not_found without calling Wikimedia for a query without letters or digits", async () => {
    expect(await resolveQuery("!!!", signal())).toEqual({ status: "not_found", query: "!!!", suggestions: [] });
    expect(calls).toHaveLength(0);
  });

  it("throws when Wikidata is unreachable, so callers can degrade", async () => {
    vi.stubGlobal("fetch", async () => new Response("down", { status: 503 }));
    await expect(resolveQuery("KBTU", signal())).rejects.toThrow(/Wikimedia API/);
  });

  it("builds pick-list cards with searchWikidata", async () => {
    const cards = await searchWikidata("MSU", signal());
    expect(cards[0]).toEqual(expect.objectContaining({ qid: expect.stringMatching(/^Q\d+$/), country: "Россия" }));
  });
});

describe("resolver ranking rules", () => {
  const entity = (overrides: Partial<RawEntity>): RawEntity => ({ id: "Q1", ...overrides });
  const p31 = (...ids: string[]) => ({
    P31: ids.map((id) => ({ mainsnak: { snaktype: "value", datavalue: { value: { id } } }, rank: "normal" as const })),
  });

  it("keeps only higher-education institutions", () => {
    expect(isHigherEducation(entity({ claims: p31("Q3918") }))).toBe(true);
    expect(isHigherEducation(entity({ claims: p31("Q41176") }))).toBe(false); // building
    expect(
      isHigherEducation(entity({ claims: p31("Q2385804"), labels: { en: { value: "Astana IT University" } } })),
    ).toBe(true);
    expect(isHigherEducation(entity({ claims: p31("Q2385804"), labels: { en: { value: "School No. 5" } } }))).toBe(
      false,
    );
  });

  it("scores exact labels above aliases above partial matches", () => {
    const variants = ["kbtu", "кбту"];
    expect(matchQuality(variants, [{ text: "KBTU", isLabel: true }])).toBe(1);
    expect(matchQuality(variants, [{ text: "КБТУ", isLabel: false }])).toBe(0.95);
    expect(matchQuality(variants, [{ text: "KBTU Almaty", isLabel: true }])).toBe(0.75);
    expect(matchQuality(["сатпаев"], [{ text: "Университет имени Сатпаева", isLabel: true }])).toBe(0.6);
    expect(matchQuality(variants, [{ text: "Something else", isLabel: true }])).toBe(0.4);
  });

  it("does not let an initial or a shorter acronym cover a longer query word", () => {
    const satbayev = { text: "Казахский национальный технический университет им. К. И. Сатпаева", isLabel: false };
    // "КазНМУ" (the medical university) starts with the initial "К." of Satbayev's name — not a match.
    expect(matchQuality(["казнму", "kaznmu"], [satbayev])).toBe(0.4);
    // "КазНУИ" (the university of arts) extends the acronym "КазНУ" — a different university.
    expect(matchQuality(["казнуи", "kaznui"], [{ text: "КазНУ", isLabel: false }])).toBe(0.4);
    // Inflected names still match: the query word extends a real word of the name.
    expect(matchQuality(["нархоза", "narkhoza"], [{ text: "Университет Нархоз", isLabel: true }])).toBe(0.6);
    expect(matchQuality(["назарбаева", "nazarbaeva"], [{ text: "Назарбаев Университет", isLabel: true }])).toBe(0.6);
  });

  it("resolves only a clear leader", () => {
    expect(decide([])).toBe("not_found");
    expect(decide([{ match: 0.95, score: 0.8 }])).toBe("resolved");
    expect(decide([{ match: 0.4, score: 0.5 }])).toBe("ambiguous");
    expect(
      decide([
        { match: 0.95, score: 0.94 },
        { match: 0.95, score: 0.9 },
      ]),
    ).toBe("ambiguous");
    expect(
      decide([
        { match: 1, score: 0.9 },
        { match: 0.4, score: 0.5 },
      ]),
    ).toBe("resolved");
    // an exact name beats a partial match of a more popular university
    expect(
      decide([
        { match: 1, score: 0.79 },
        { match: 0.75, score: 0.74 },
      ]),
    ).toBe("resolved");
  });

  it("does not let an empty Wikidata duplicate win over a documented university", () => {
    // A lone exact match with no data behind it is still the only answer there is.
    expect(decide([{ match: 1, score: 0.6, stub: true }])).toBe("resolved");
    // A partial match on an empty item is a guess — ask instead.
    expect(decide([{ match: 0.75, score: 0.42, stub: true }])).toBe("ambiguous");
    // An exact but empty item does not beat a documented one by exactness alone.
    expect(
      decide([
        { match: 1, score: 0.6, stub: true },
        { match: 0.6, score: 0.58 },
      ]),
    ).toBe("ambiguous");
  });

  it("interleaves search results without duplicates", () => {
    expect(interleave([["a", "b", "c"], ["d", "a"], []])).toEqual(["a", "d", "b", "c"]);
  });
});
