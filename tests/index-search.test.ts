import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { acronymsOf, getIndex, indexedUniversityName, indexEntity, searchIndex } from "@/lib/resolver/indexSearch";
import { resolveFromIndex, resolveQuery } from "@/lib/resolver/resolve";
import type { UniversityIndexEntry } from "@/lib/types";

/** Runs on the real committed index (data/universities.min.json, P3 #24). Network is forbidden here. */
let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  fetchSpy = vi.fn(async () => {
    throw new Error("network is not allowed in index tests");
  });
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => vi.unstubAllGlobals());

const signal = () => new AbortController().signal;

describe("resolver v1: local index first", () => {
  it.each([
    ["KBTU", "Q1734762"],
    ["КБТУ", "Q1734762"],
    ["Nazarbayev University", "Q2783344"],
    ["Назарбаев", "Q2783344"],
    ["МГУ", "Q13164"],
    ["Satpaev", "Q1513804"],
    ["КазНУ", "Q427677"],
    ["kaznu", "Q427677"],
    ["Букетов", "Q920456"],
    // #109 · Wikidata has no "ЕНУ" alias: the acronym is generated from the Russian name.
    ["ЕНУ", "Q127745"],
    ["ENU", "Q127745"],
    ["Gumilev", "Q127745"],
  ])("%s → %s without Wikimedia calls", async (query, qid) => {
    const result = await resolveQuery(query, signal());
    expect(result).toMatchObject({ status: "resolved", entity: { qid } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["КазНМУ", "Q1513804"],
    ["KazNMU", "Q1513804"],
    ["КазНК", "Q1513804"],
    ["КазНУИ", "Q427677"],
  ])("%s is not resolved to %s by an initial or a shorter acronym in its name", (query, wrongQid) => {
    const result = resolveFromIndex(query);
    expect(result?.status === "resolved" ? result.entity.qid : null).not.toBe(wrongQid);
  });

  // …and they reach the right university instead of falling through to a Wikidata that has no such alias.
  it.each([
    ["КазНМУ", "Q4208094"],
    ["KazNMU", "Q4208094"],
    ["КазНИТУ", "Q1513804"],
    ["КазНПУ", "Q1734795"],
    ["КазНАУ", "Q4208096"],
    ["КазНУИ", "Q4208095"],
    ["КазНАИ", "Q4208080"],
  ])("%s → %s from the generated syllabic acronym", async (query, qid) => {
    const result = await resolveQuery(query, signal());
    expect(result).toMatchObject({ status: "resolved", entity: { qid } });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns a pick-list when several indexed universities share an abbreviation", async () => {
    const result = await resolveQuery("MSU", signal());
    expect(result.status).toBe("ambiguous");
    if (result.status !== "ambiguous") return;
    expect(result.candidates.map((c) => c.qid)).toEqual(expect.arrayContaining(["Q13164", "Q270222"]));
    expect(result.candidates[0]).toMatchObject({ city: expect.any(String), country: expect.any(String) });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("falls back to Wikidata for names outside the index, and to index suggestions if Wikidata is down", async () => {
    const result = await resolveQuery("Карагандинский зоопарк", signal());
    expect(fetchSpy).toHaveBeenCalled();
    expect(result.status).toBe("not_found");
    if (result.status !== "not_found") return;
    expect(result.suggestions.length).toBeGreaterThan(0);
    expect(result.suggestions[0].name).toMatch(/Караганд/);
  });

  it("still throws for an unknown name when both Wikidata and the index have nothing", async () => {
    await expect(resolveQuery("zzqxw", signal())).rejects.toThrow();
  });
});

describe("index search", () => {
  it("names an indexed university for the browser tab without a network call", () => {
    expect(indexedUniversityName("Q1734762")).toBe("Казахстанско-Британский технический университет");
    expect(indexedUniversityName("Q42")).toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("tolerates a typo in a long word but not in an abbreviation", () => {
    expect(searchIndex("Nazarbaev")[0]?.entry.qid).toBe("Q2783344");
    expect(searchIndex("KSTU").map((hit) => hit.entry.qid)).not.toContain("Q1734762");
  });

  it("generates the syllabic Kazakh acronym next to the plain initials", () => {
    const medical = getIndex().entries.get("Q4208094") as UniversityIndexEntry;
    expect(acronymsOf(medical)).toEqual(expect.arrayContaining(["кнму", "казнму"]));
    // The syllable is only for names that start with it — "Гарвардский университет" keeps plain initials.
    const harvard = getIndex().entries.get("Q13371") as UniversityIndexEntry;
    expect(acronymsOf(harvard).every((acronym) => !acronym.startsWith("каз"))).toBe(true);
  });

  it("maps an entry to a UniversityEntity with ordered Wikipedia links", () => {
    const entry: UniversityIndexEntry = {
      qid: "Q1",
      names: { en: "Test University", ru: "Тестовый университет" },
      aliases: ["TU"],
      country: "Казахстан",
      countryCode: "KZ",
      city: { name: "Астана", qid: "Q1520", lat: 51.1, lon: 71.4, commonsCategory: "Astana" },
      domains: ["test.kz"],
      sitelinks: 3,
      logo: "Test logo.svg",
      wikipedia: [
        { lang: "en", title: "Test University" },
        { lang: "ru", title: "Тестовый университет" },
      ],
    };
    const entity = indexEntity(entry);
    expect(entity.name).toBe("Тестовый университет");
    expect(entity.city).toEqual({ name: "Астана", qid: "Q1520", lat: 51.1, lon: 71.4 });
    expect(entity.wikipedia.map((w) => w.lang)).toEqual(["ru", "en"]);
    expect(entity.wikipedia[1].url).toBe("https://en.wikipedia.org/wiki/Test_University");
    expect(entity.logoUrl).toContain("Special:FilePath/Test_logo.svg");
  });
});
