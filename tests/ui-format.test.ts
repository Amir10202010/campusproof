import { describe, expect, it } from "vitest";
import { samplePhotos } from "@/fixtures/profile.sample";
import { applyFilters, DEFAULT_FILTERS, lensOf, sortForDisplay, withLens } from "@/lib/ui/filters";
import {
  displayHost,
  formatDateRu,
  formatDateTimeRu,
  formatDistanceRu,
  formatSecondsRu,
  photoAlt,
  photoDateText,
  pluralRu,
  safeHttpUrl,
} from "@/lib/ui/format";

const NBSP = " ";

describe("formatDistanceRu", () => {
  it("uses meters below a kilometer and one decimal below ten", () => {
    expect(formatDistanceRu(80)).toBe("80 м");
    expect(formatDistanceRu(344)).toBe("340 м");
    expect(formatDistanceRu(1_240)).toBe("1,2 км");
    expect(formatDistanceRu(11_200)).toBe("11 км");
    expect(formatDistanceRu(1_240_000)).toBe(`1${NBSP}240 км`);
  });
});

describe("formatDateTimeRu", () => {
  it("shows day, month, year and time; keeps broken input as is", () => {
    expect(formatDateTimeRu("2026-09-17T09:00:16.420Z")).toMatch(/^\d{2}\.\d{2}\.2026, \d{2}:\d{2}$/);
    expect(formatDateTimeRu("вчера")).toBe("вчера");
  });
});

describe("formatSecondsRu", () => {
  it("formats milliseconds as seconds with a decimal comma", () => {
    expect(formatSecondsRu(16_420)).toBe("16,4 с");
    expect(formatSecondsRu(240)).toBe("0,2 с");
  });
});

describe("safeHttpUrl", () => {
  it("keeps only http(s) links from sources", () => {
    expect(safeHttpUrl("https://example.edu/a b")).toBe("https://example.edu/a%20b");
    expect(safeHttpUrl("http://example.edu")).toBe("http://example.edu/");
    expect(safeHttpUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeHttpUrl("data:text/html,hi")).toBeUndefined();
    expect(safeHttpUrl("not a url")).toBeUndefined();
    expect(safeHttpUrl(undefined)).toBeUndefined();
  });

  it("shows a short host", () => {
    expect(displayHost("https://www.example.edu/about")).toBe("example.edu");
    expect(displayHost("not a url")).toBe("not a url");
  });
});

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

describe("source lens", () => {
  it("maps sourceTypes to a lens and back", () => {
    const base = { categories: [], sourceTypes: [], showUnconfirmed: false };
    expect(lensOf(base)).toBe("all");
    const official = withLens(base, "official");
    expect(official.sourceTypes).toEqual(["official"]);
    expect(lensOf(official)).toBe("official");
    const independent = withLens(official, "independent");
    expect(independent.sourceTypes).not.toContain("official");
    expect(independent.sourceTypes).not.toContain("unknown");
    expect(lensOf({ ...independent, sourceTypes: [...independent.sourceTypes].reverse() })).toBe("independent");
    expect(lensOf({ ...base, sourceTypes: ["unknown"] })).toBe("all");
  });

  it("hides official photos under the independent lens", () => {
    const shown = applyFilters(samplePhotos, withLens(DEFAULT_FILTERS, "independent"));
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((p) => p.sourceType !== "official")).toBe(true);
  });
});
