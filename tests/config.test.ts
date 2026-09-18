import { describe, expect, it } from "vitest";
import { CATEGORIES, MANDATORY_FILTERS, REQUIRED_AREAS } from "@/lib/config/categories";
import { hostInList, hostMatches, STOCK_DOMAINS } from "@/lib/config/domains";
import { TIER_THRESHOLDS } from "@/lib/config/limits";
import { positiveInt } from "@/lib/env";

describe("categories config", () => {
  it("has 8 unique categories with RU labels and definitions", () => {
    expect(CATEGORIES).toHaveLength(8);
    expect(new Set(CATEGORIES.map((c) => c.id)).size).toBe(8);
    for (const c of CATEGORIES) {
      expect(c.labelRu.length).toBeGreaterThan(0);
      expect(c.definition.length).toBeGreaterThan(20);
      expect(c.queries.en.length + c.queries.ru.length).toBeGreaterThan(0);
    }
  });

  it("covers the 5 mandatory photo areas from the case", () => {
    expect(REQUIRED_AREAS.map((c) => c.id)).toEqual(["campus", "dormitory", "classroom", "library", "city"]);
  });

  it("covers the 4 mandatory filters from the case", () => {
    expect(MANDATORY_FILTERS.map((c) => c.filterLabelRu)).toEqual([
      "Общежитие",
      "Спорт",
      "Лаборатории",
      "Студенческая жизнь",
    ]);
  });
});

describe("domain matching", () => {
  it("matches exact domains and subdomains only", () => {
    expect(hostMatches("www.shutterstock.com", "shutterstock.com")).toBe(true);
    expect(hostMatches("image.shutterstock.com", "shutterstock.com")).toBe(true);
    expect(hostMatches("notshutterstock.com", "shutterstock.com")).toBe(false);
    expect(hostInList("media.istockphoto.com", STOCK_DOMAINS)).toBe(true);
  });
});

describe("tier thresholds", () => {
  it("are strictly ordered", () => {
    expect(TIER_THRESHOLDS.verified).toBeGreaterThan(TIER_THRESHOLDS.likely);
    expect(TIER_THRESHOLDS.likely).toBeGreaterThan(TIER_THRESHOLDS.unconfirmed);
  });
});

describe("numeric environment variables", () => {
  it("falls back to the documented default instead of NaN", () => {
    // Ratelimit(NaN) refuses nothing, so a typo in a Vercel env var must not disable the limit.
    expect(positiveInt("forty", 40)).toBe(40);
    expect(positiveInt(undefined, 150)).toBe(150);
    expect(positiveInt("", 150)).toBe(150);
    expect(positiveInt("0", 150)).toBe(150);
    expect(positiveInt("-5", 150)).toBe(150);
    expect(positiveInt("12.5", 150)).toBe(150);
    expect(positiveInt(" 25 ", 150)).toBe(25);
  });
});
