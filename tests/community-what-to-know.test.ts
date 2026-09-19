import { describe, expect, it } from "vitest";
import { collectFacts } from "@/lib/community/whatToKnow";
import type { CategoryCoverage, CategoryId, Photo, UniversityProfile } from "@/lib/types";

const EMPTY_COVERAGE: CategoryCoverage = { verified: 0, likely: 0, unconfirmed: 0, status: "none" };

function coverage(overrides: Partial<Record<CategoryId, CategoryCoverage>> = {}): Record<CategoryId, CategoryCoverage> {
  const base = Object.fromEntries(
    ["campus", "dormitory", "classroom", "library", "city", "sports", "lab", "student_life"].map((id) => [
      id,
      EMPTY_COVERAGE,
    ]),
  ) as Record<CategoryId, CategoryCoverage>;
  return { ...base, ...overrides };
}

function photo(over: Partial<Photo> = {}): Photo {
  return {
    id: "p1",
    imageUrl: "https://test.edu.kz/a.jpg",
    thumbUrl: "https://test.edu.kz/a.jpg",
    sourcePageUrl: "https://test.edu.kz/a",
    sourceDomain: "test.edu.kz",
    sourceType: "official",
    provider: "web_search",
    retrievedAt: new Date().toISOString(),
    category: "library",
    secondary: [],
    tier: "verified",
    points: 70,
    evidence: [],
    labels: [],
    alsoFoundAt: [],
    dHash: "0000000000000000",
    ...over,
  };
}

function profile(over: Partial<UniversityProfile> = {}): UniversityProfile {
  return {
    pipelineVersion: "0.1.0",
    entity: {
      qid: "Q1",
      name: "Тест",
      names: {},
      aliases: [],
      country: "Казахстан",
      countryCode: "KZ",
      domains: ["test.edu.kz"],
      wikipedia: [],
    },
    facts: [],
    description: null,
    photos: [],
    rejected: [],
    coverage: coverage(),
    sources: [],
    degraded: [],
    timings: { totalMs: 1000, stages: {} },
    generatedAt: new Date().toISOString(),
    ...over,
  };
}

describe("collectFacts", () => {
  it("names sections with zero confirmed coverage", () => {
    const facts = collectFacts(profile({ coverage: coverage({ dormitory: EMPTY_COVERAGE }) }));
    expect(facts.some((f) => f.text.includes("Общежития"))).toBe(true);
  });

  it("flags a section where every photo is official-only", () => {
    const facts = collectFacts(profile({ photos: [photo({ category: "library", sourceType: "official" })] }));
    expect(facts.some((f) => f.text.includes("Библиотеки") && f.text.includes("официального сайта"))).toBe(true);
  });

  it("does not flag a section that has a non-official photo", () => {
    const facts = collectFacts(
      profile({
        photos: [
          photo({ category: "library", sourceType: "official" }),
          photo({ id: "p2", category: "library", sourceType: "encyclopedic" }),
        ],
      }),
    );
    expect(facts.some((f) => f.text.includes("официального сайта"))).toBe(false);
  });

  it("includes distance to city center when present", () => {
    const facts = collectFacts(profile({ distanceToCityCenterM: 4200 }));
    expect(facts.some((f) => f.text.includes("км"))).toBe(true);
  });

  it("summarizes rejected candidates by reason", () => {
    const facts = collectFacts(
      profile({
        rejected: [
          { sourcePageUrl: "https://x", reason: "duplicate", detail: "" },
          { sourcePageUrl: "https://y", reason: "duplicate", detail: "" },
          { sourcePageUrl: "https://z", reason: "stock_source", detail: "" },
        ],
      }),
    );
    expect(facts.some((f) => f.text.includes("Отсеяно кандидатов") && f.text.includes("duplicate (2)"))).toBe(true);
  });

  it("every fact carries a source label — nothing unsourced", () => {
    const facts = collectFacts(
      profile({
        facts: [{ label: "Основан", value: "2010", sourceUrl: "https://wikidata.org/Q1" }],
        distanceToCityCenterM: 1000,
      }),
    );
    expect(facts.every((f) => f.sourceLabel.length > 0)).toBe(true);
  });
});
