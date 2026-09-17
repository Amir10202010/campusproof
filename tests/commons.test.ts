import { afterEach, describe, expect, it, vi } from "vitest";
import recorded from "@/tests/data/commons.json";
import { replayFetch } from "@/tests/helpers/replayFetch";
import { createRunContext } from "@/lib/pipeline/context";
import {
  gatherCommons,
  hintFromText,
  isoDate,
  mentionsName,
  NON_PHOTO,
  pickRelevantSubcategories,
  stripHtml,
} from "@/lib/sources/commons";
import type { UniversityEntity } from "@/lib/types";

/** Real Commons + Wikipedia responses for Nazarbayev University, recorded 17 Sep 2026 (trimmed to 14 files per call). */
const nu = recorded.entities.Q2783344 as unknown as UniversityEntity;
const responses = recorded.responses as Record<string, unknown>;
const ctx = () => createRunContext({ signal: new AbortController().signal });

afterEach(() => vi.unstubAllGlobals());

describe("gatherCommons (recorded responses)", () => {
  it("returns ≥20 free, sourced, dated and licensed candidates for Nazarbayev University within 8 calls", async () => {
    const calls = replayFetch(responses);
    const { candidates } = await gatherCommons(nu, ctx());
    expect(candidates.length).toBeGreaterThanOrEqual(20);
    expect(calls.length).toBeLessThanOrEqual(8);
    for (const candidate of candidates) {
      expect(candidate.sourcePageUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\/wiki\/File:/);
      expect(candidate.imageUrl).not.toContain("utm_");
      expect(candidate.date?.value).toMatch(/^\d{4}-\d{2}/);
      expect(candidate.license?.name).toBeTruthy();
      expect(candidate.license?.author ?? "").not.toMatch(/[<>]/);
      expect(candidate.provenance.sourceType).toBe("encyclopedic");
    }
  });

  it("marks provenance: category tree, depicts, used on Wikipedia, city photos", async () => {
    replayFetch(responses);
    const { candidates } = await gatherCommons(nu, ctx());
    expect(candidates.filter((c) => c.provenance.commonsCategoryMatch).length).toBeGreaterThanOrEqual(10);
    expect(candidates.some((c) => c.provenance.depictsQid)).toBe(true);
    expect(candidates.find((c) => c.provenance.usedOnWikipedia)?.title).toBe("Nazarbaev University Astana");
    expect(candidates.filter((c) => c.categoryHint === "city").length).toBeGreaterThan(0);
    expect(candidates.every((c) => c.sourceDomain === "commons.wikimedia.org")).toBe(true);
    expect(candidates.find((c) => c.title === "Назарбаев Университеті")).toMatchObject({
      date: { value: "2011-05-12", kind: "taken" },
      license: { name: "CC BY-SA 3.0", author: "Qarakesek" },
      thumbUrl: expect.stringContaining("/500px-"),
    });
  });

  it("degrades when some calls fail and throws only when all fail", async () => {
    replayFetch(Object.fromEntries(Object.entries(responses).filter(([url]) => !url.includes("generator=geosearch"))));
    const partial = await gatherCommons(nu, ctx());
    expect(partial.candidates.length).toBeGreaterThan(0);

    vi.stubGlobal("fetch", async () => new Response("down", { status: 503 }));
    await expect(gatherCommons(nu, ctx())).rejects.toThrow(/Wikimedia API/);
  });
});

describe("commons helpers", () => {
  it("strips HTML and decodes entities from extmetadata", () => {
    expect(stripHtml('<a href="//commons.wikimedia.org/wiki/User:X">Jane &amp; John</a>&nbsp;<b>Doe</b>')).toBe(
      "Jane & John Doe",
    );
    expect(stripHtml("&#1040;&#x411;")).toBe("АБ");
  });

  it("parses dates into ISO", () => {
    expect(isoDate("2014-06-09 09:59:12")).toBe("2014-06-09");
    expect(isoDate('<time class="dtstart" datetime="2019-11-02">2 November 2019</time>')).toBe("2019-11-02");
    expect(isoDate("2014-06")).toBe("2014-06");
    expect(isoDate("unknown date")).toBeUndefined();
  });

  it("rejects non-photos by title/category keywords", () => {
    expect(NON_PHOTO.test("Logo of Nazarbayev University")).toBe(true);
    expect(NON_PHOTO.test("Карта кампуса")).toBe(true);
    expect(NON_PHOTO.test("Nazarbayev University main building at night")).toBe(false);
    expect(NON_PHOTO.test("Photographs of flags of Kazakhstan")).toBe(false);
    expect(NON_PHOTO.test("Картинная галерея")).toBe(false);
    expect(NON_PHOTO.test("Герб университета")).toBe(true);
  });

  it("hints categories from names, never the city for university files", () => {
    expect(hintFromText("Library of Harvard University")).toBe("library");
    expect(hintFromText("Общежитие №3")).toBe("dormitory");
    expect(hintFromText("Main square of the campus")).toBe("campus");
    expect(hintFromText("Street view")).toBeUndefined();
  });

  it("picks up to 4 relevant subcategories, one per category first, never people", () => {
    expect(
      pickRelevantSubcategories([
        "People of Harvard University",
        "Widener Library",
        "Harvard University Library",
        "Campus of Harvard University",
        "Harvard University athletics",
        "Harvard Cyclotron Laboratory",
        "Dormitories of Harvard",
        "Harvard Art Museums",
      ]),
    ).toEqual([
      "Widener Library",
      "Campus of Harvard University",
      "Harvard Cyclotron Laboratory",
      "Dormitories of Harvard",
    ]);
  });

  it("detects whole-word name mentions only", () => {
    expect(mentionsName("RAs with professor at Nazarbayev University", nu)).toBe(true);
    expect(mentionsName("Назарбаев Университетінің бас ғимараты", nu)).toBe(false);
    expect(mentionsName("Minute of silence", { ...nu, aliases: ["NU"] })).toBe(false);
  });
});
