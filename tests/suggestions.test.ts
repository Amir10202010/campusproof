import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import recorded from "@/tests/data/wikidata-suggestions.json";
import { replayFetch } from "@/tests/helpers/replayFetch";

// These tests cover the live Wikidata path: the local index (#14) is switched off (tests/index-search.test.ts covers it).
vi.mock("@/lib/resolver/indexSearch", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/resolver/indexSearch")>()),
  searchIndex: () => [],
}));
import { resolveQuery } from "@/lib/resolver/resolve";
import { editDistance, fuzzySimilarity, MIN_FUZZY_SIMILARITY } from "@/lib/resolver/wikidata";
import { clearWikidataMemo } from "@/lib/sources/wikidata";

/** Real Wikidata responses recorded on 17 Sep 2026. */
beforeEach(() => {
  clearWikidataMemo();
  replayFetch(recorded as Record<string, unknown>);
});
afterEach(() => vi.unstubAllGlobals());

const signal = () => new AbortController().signal;

describe("not_found suggestions", () => {
  it("suggests the intended university for a typo instead of auto-selecting it", async () => {
    const result = await resolveQuery("Harvrad", signal());
    expect(result.status).toBe("not_found");
    if (result.status !== "not_found") return;
    expect(result.suggestions[0]).toMatchObject({ qid: "Q13371", city: "Кембридж", country: "США" });
    expect(result.suggestions.length).toBeLessThanOrEqual(6);
  });

  it("ignores a misspelled filler word", async () => {
    const result = await resolveQuery("Nazarbaev Univrsity", signal());
    expect(result).toMatchObject({ status: "not_found", suggestions: [{ qid: "Q2783344" }] });
  });

  it("does not invent suggestions for gibberish", async () => {
    expect(await resolveQuery("asdfgh", signal())).toEqual({ status: "not_found", query: "asdfgh", suggestions: [] });
  });
});

describe("fuzzy similarity", () => {
  it("counts an adjacent transposition as one edit", () => {
    expect(editDistance("harvrad", "harvard")).toBe(1);
    expect(editDistance("kbtu", "kbtu")).toBe(0);
    expect(editDistance("", "abc")).toBe(3);
  });

  it("keeps close names and drops far ones", () => {
    const harvard = [{ text: "Harvard University" }];
    expect(fuzzySimilarity(["harvrad"], harvard)).toBeGreaterThanOrEqual(MIN_FUZZY_SIMILARITY);
    expect(fuzzySimilarity(["nazarbaev univrsity"], [{ text: "Nazarbayev University" }])).toBeGreaterThanOrEqual(
      MIN_FUZZY_SIMILARITY,
    );
    expect(fuzzySimilarity(["asdfgh"], [{ text: "Asgard Academy" }])).toBeLessThan(MIN_FUZZY_SIMILARITY);
  });
});
