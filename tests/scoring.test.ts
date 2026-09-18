import { describe, expect, it } from "vitest";
import { dedupeCandidates } from "@/lib/images/dedup";
import { scoreCandidate } from "@/lib/scoring/score";
import { decideTier } from "@/lib/scoring/tiers";
import type { FetchedCandidate, ScoringContext, UniversityEntity, VisionObservation } from "@/lib/types";

const entity: UniversityEntity = {
  qid: "Q1234",
  name: "Тестовый университет",
  names: { ru: "Тестовый университет", en: "Test University" },
  aliases: ["ТУ"],
  country: "Казахстан",
  countryCode: "KZ",
  city: { name: "Астана", lat: 51.128, lon: 71.43 },
  coords: { lat: 51.0906, lon: 71.3986 },
  domains: ["test.edu.kz"],
  wikipedia: [],
};

const context: ScoringContext = { entity, visionAvailable: true };

function candidate(over: Partial<FetchedCandidate> = {}): FetchedCandidate {
  return {
    id: "img1",
    imageUrl: "https://test.edu.kz/photo.jpg",
    canonicalUrl: "https://test.edu.kz/photo.jpg",
    sourcePageUrl: "https://test.edu.kz/campus",
    sourceDomain: "test.edu.kz",
    provider: "web_search",
    provenance: { sourceType: "official" },
    prepared: { jpeg: Buffer.alloc(0), width: 1200, height: 900, dHash: "0f0f0f0f0f0f0f0f" },
    lowRes: false,
    alsoFoundAt: [],
    ...over,
  };
}

function observation(over: Partial<VisionObservation> = {}): VisionObservation {
  return {
    id: "img1",
    image_type: "photo",
    stock_like: false,
    watermark_text: null,
    primary_category: "campus",
    secondary_categories: [],
    visible_text: "",
    names_institution: "none",
    other_institution_name: null,
    scene_consistent_with_context: "unclear",
    close_up_portrait: false,
    near_duplicate_of: null,
    quality: 4,
    reason: "",
    ...over,
  };
}

describe("scoreCandidate", () => {
  it("always reports points that equal the sum of the shown evidence", () => {
    const result = scoreCandidate(
      candidate({
        provenance: {
          sourceType: "encyclopedic",
          depictsQid: true,
          commonsCategoryMatch: true,
          pageMentionsName: true,
        },
        geo: { lat: 51.0909, lon: 71.3992 },
        lowRes: true,
      }),
      observation({
        names_institution: "this",
        visible_text: "Test University",
        scene_consistent_with_context: "consistent",
      }),
      context,
    );
    expect(result.points).toBe(result.evidence.reduce((sum, item) => sum + item.points, 0));
  });

  it("marks a Commons photo taken at the campus as verified", () => {
    const result = scoreCandidate(
      candidate({
        provenance: { sourceType: "encyclopedic", depictsQid: true, commonsCategoryMatch: true },
        geo: { lat: 51.0909, lon: 71.3992 },
      }),
      observation(),
      context,
    );
    expect(result.tier).toBe("verified");
    expect(result.points).toBe(45 + 40 + 35);
    expect(result.evidence.map((item) => item.signal)).toContain("geo_near_campus");
  });

  it("keeps a photo whose only evidence is a page mention at unconfirmed", () => {
    const result = scoreCandidate(
      candidate({ provenance: { sourceType: "independent", pageMentionsName: true } }),
      observation(),
      context,
    );
    expect(result.points).toBe(15);
    expect(result.tier).toBe("unconfirmed");
  });

  it("does not reach verified on medium signals alone", () => {
    const result = scoreCandidate(
      candidate({
        provenance: { sourceType: "news", pageMentionsName: true },
        sourceDomain: "tengrinews.kz",
        alsoFoundAt: [{ sourcePageUrl: "https://other.kz/a", sourceDomain: "other.kz" }],
      }),
      observation({ scene_consistent_with_context: "consistent" }),
      context,
    );
    expect(result.points).toBe(15 + 10 + 15 + 10);
    expect(result.tier).toBe("likely");
  });

  it("rejects a photo geotagged far from the campus", () => {
    const result = scoreCandidate(
      candidate({ provenance: { sourceType: "official", officialDomain: true }, geo: { lat: 43.238, lon: 76.889 } }),
      observation(),
      context,
    );
    expect(result.tier).toBe("rejected");
    expect(result.reject?.reason).toBe("far_geotag");
  });

  it("rejects photos of another university, non-photos and close-up portraits", () => {
    const other = scoreCandidate(
      candidate({ provenance: { sourceType: "official", officialDomain: true } }),
      observation({ names_institution: "other", other_institution_name: "Другой университет" }),
      context,
    );
    expect(other.reject?.reason).toBe("other_institution");

    const logo = scoreCandidate(candidate(), observation({ image_type: "logo_or_emblem" }), context);
    expect(logo.reject?.reason).toBe("not_a_photo");

    const portrait = scoreCandidate(candidate(), observation({ close_up_portrait: true }), context);
    expect(portrait.reject?.reason).toBe("portrait");
  });

  it("labels a render and never calls it verified", () => {
    const result = scoreCandidate(
      candidate({ provenance: { sourceType: "encyclopedic", depictsQid: true, commonsCategoryMatch: true } }),
      observation({ image_type: "render_or_illustration" }),
      context,
    );
    expect(result.labels).toContain("render");
    expect(result.points).toBe(45 + 40 - 40);
    expect(result.tier).toBe("likely");
  });

  it("counts an official page with a stock-looking photo as a weak hint", () => {
    const result = scoreCandidate(
      candidate({ provenance: { sourceType: "official", officialDomain: true } }),
      observation({ stock_like: true }),
      context,
    );
    expect(result.points).toBe(10);
    expect(result.tier).toBe("unconfirmed");
  });

  it("says so when the visual check was unavailable and caps web-only photos", () => {
    const webOnly = scoreCandidate(
      candidate({
        provenance: { sourceType: "independent", pageMentionsName: true },
        alsoFoundAt: [{ sourcePageUrl: "https://other.kz/a", sourceDomain: "other.kz" }],
        geo: { lat: 51.16, lon: 71.47 },
      }),
      null,
      { ...context, visionAvailable: false },
    );
    expect(webOnly.labels).toContain("visual_check_unavailable");
    expect(webOnly.points).toBe(15 + 15 + 10);
    expect(webOnly.tier).toBe("unconfirmed");

    const strong = scoreCandidate(
      candidate({ provenance: { sourceType: "official", officialDomain: true, pageMentionsName: true } }),
      null,
      { ...context, visionAvailable: false },
    );
    expect(strong.tier).toBe("likely");
  });

  it("does not promote a photo the model never looked at, even while vision is running (#118)", () => {
    // Quota can die mid-run: the stage still reports "ok", but this image has no observation.
    // The label and the tier have to agree — otherwise an unchecked photo reads as "Вероятно".
    const unchecked = scoreCandidate(
      candidate({
        provenance: { sourceType: "independent", pageMentionsName: true },
        alsoFoundAt: [{ sourcePageUrl: "https://other.kz/a", sourceDomain: "other.kz" }],
        geo: { lat: 51.16, lon: 71.47 },
      }),
      null,
      { ...context, visionAvailable: true },
    );
    expect(unchecked.points).toBe(40);
    expect(unchecked.labels).toContain("visual_check_unavailable");
    expect(unchecked.tier).toBe("unconfirmed");
  });

  it("flags a thumbnail-only check and an old photo", () => {
    const result = scoreCandidate(
      candidate({
        provenance: { sourceType: "official", officialDomain: true },
        lowRes: true,
        date: { value: "2009-05-01", kind: "published" },
      }),
      observation(),
      context,
    );
    expect(result.labels).toEqual(expect.arrayContaining(["low_res_verification", "possibly_outdated"]));
    expect(result.points).toBe(30 - 10);
  });

  it("takes the category from the model and keeps distinct secondary categories", () => {
    const result = scoreCandidate(
      candidate({ categoryHint: "campus" }),
      observation({ primary_category: "library", secondary_categories: ["campus", "campus", "library"] }),
      context,
    );
    expect(result.category).toBe("library");
    expect(result.secondary).toEqual(["campus"]);
  });
});

describe("decideTier", () => {
  it("requires a strong signal and no negative visual for verified", () => {
    const base = { points: 70, strong: true, negativeVisual: false, visionAvailable: true };
    expect(decideTier(base)).toBe("verified");
    expect(decideTier({ ...base, strong: false })).toBe("likely");
    expect(decideTier({ ...base, negativeVisual: true })).toBe("likely");
    expect(decideTier({ ...base, points: 9, strong: false })).toBe("rejected");
  });
});

describe("dedupeCandidates", () => {
  const prepared = (dHash: string) => ({ jpeg: Buffer.alloc(0), width: 1000, height: 800, dHash });

  it("keeps the strongest copy and records where the others were found", () => {
    const commons = candidate({
      id: "commons",
      canonicalUrl: "https://upload.wikimedia.org/a.jpg",
      sourcePageUrl: "https://commons.wikimedia.org/wiki/File:A.jpg",
      sourceDomain: "commons.wikimedia.org",
      provenance: { sourceType: "encyclopedic", depictsQid: true, commonsCategoryMatch: true },
      prepared: prepared("0f0f0f0f0f0f0f0f"),
    });
    const copy = candidate({
      id: "news",
      canonicalUrl: "https://tengrinews.kz/b.jpg",
      sourcePageUrl: "https://tengrinews.kz/news/1",
      sourceDomain: "tengrinews.kz",
      provenance: { sourceType: "news", pageMentionsName: true },
      // one bit apart → the same photo, recompressed
      prepared: prepared("0f0f0f0f0f0f0f0e"),
    });

    const { kept, rejected } = dedupeCandidates([copy, commons]);
    expect(kept.map((item) => item.id)).toEqual(["commons"]);
    expect(kept[0].alsoFoundAt).toEqual([
      { sourcePageUrl: "https://tengrinews.kz/news/1", sourceDomain: "tengrinews.kz" },
    ]);
    expect(rejected).toEqual([
      expect.objectContaining({
        reason: "duplicate",
        duplicateOf: "commons",
        sourcePageUrl: "https://tengrinews.kz/news/1",
      }),
    ]);
  });

  it("keeps different photos and does not touch the input", () => {
    const a = candidate({ id: "a", canonicalUrl: "https://test.edu.kz/a.jpg", prepared: prepared("ffffffffffffffff") });
    const b = candidate({ id: "b", canonicalUrl: "https://test.edu.kz/b.jpg", prepared: prepared("0000000000000000") });
    const { kept, rejected } = dedupeCandidates([a, b]);
    expect(kept).toHaveLength(2);
    expect(rejected).toHaveLength(0);
    expect(a.alsoFoundAt).toEqual([]);
  });

  it("treats the same canonical URL as a duplicate even when hashes differ", () => {
    const first = candidate({ id: "first", prepared: prepared("ffffffffffffffff") });
    const second = candidate({
      id: "second",
      sourcePageUrl: "https://test.edu.kz/another-page",
      prepared: prepared("0000000000000000"),
    });
    const { kept, rejected } = dedupeCandidates([first, second]);
    expect(kept).toHaveLength(1);
    expect(rejected[0]).toMatchObject({ reason: "duplicate", detail: "Тот же файл, что уже показан выше" });
  });
});
