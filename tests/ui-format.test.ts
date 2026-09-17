import { describe, expect, it } from "vitest";
import { samplePhotos } from "@/fixtures/profile.sample";
import { sortForDisplay } from "@/lib/ui/filters";
import { formatDateRu, photoAlt, photoDateText, pluralRu } from "@/lib/ui/format";

describe("formatDateRu", () => {
  it("formats full, partial and timestamp dates", () => {
    expect(formatDateRu("2023-06-12")).toBe("12.06.2023");
    expect(formatDateRu("2026-09-17T09:00:00.000Z")).toBe("17.09.2026");
    expect(formatDateRu("2019-08-30 14:05:00")).toBe("30.08.2019");
    expect(formatDateRu("2019-06")).toBe("06.2019");
    expect(formatDateRu("2019")).toBe("2019");
  });

  it("keeps Wikidata precision and never invents a day", () => {
    expect(formatDateRu("+2019-00-00T00:00:00Z")).toBe("2019");
    expect(formatDateRu("2019-06-00")).toBe("06.2019");
  });

  it("shows unknown formats as they are", () => {
    expect(formatDateRu("весна 2019")).toBe("весна 2019");
  });
});

describe("photoDateText", () => {
  it("prefixes the date with its kind", () => {
    expect(photoDateText({ date: { value: "2023-06-12", kind: "taken" }, retrievedAt: "2026-09-17T09:00:00Z" })).toBe(
      "снято 12.06.2023",
    );
  });

  it("falls back to the retrieval time when the source has no date", () => {
    expect(photoDateText({ retrievedAt: "2026-09-17T09:00:00Z" })).toBe("получено 17.09.2026");
  });
});

describe("photoAlt", () => {
  it("uses the title or describes category and source", () => {
    expect(photoAlt({ title: "Главный корпус", category: "campus", sourceDomain: "example.edu" })).toBe(
      "Главный корпус",
    );
    expect(photoAlt({ title: " ", category: "library", sourceDomain: "example.edu" })).toBe(
      "Библиотеки: фото с example.edu",
    );
  });
});

describe("pluralRu", () => {
  const forms = ["источник", "источника", "источников"] as const;
  it.each([
    [1, "источник"],
    [2, "источника"],
    [5, "источников"],
    [11, "источников"],
    [12, "источников"],
    [21, "источник"],
    [24, "источника"],
    [111, "источников"],
  ])("%i → %s", (n, expected) => {
    expect(pluralRu(n, forms)).toBe(expected);
  });
});

describe("sortForDisplay", () => {
  it("puts higher tiers and stronger evidence first without mutating the input", () => {
    const input = [...samplePhotos].reverse();
    const sorted = sortForDisplay(input);
    const rank = { verified: 0, likely: 1, unconfirmed: 2 };
    for (let i = 1; i < sorted.length; i++) {
      const [a, b] = [sorted[i - 1], sorted[i]];
      expect(rank[a.tier] < rank[b.tier] || (a.tier === b.tier && a.points >= b.points)).toBe(true);
    }
    expect(input[0].id).toBe(samplePhotos.at(-1)?.id);
  });
});
