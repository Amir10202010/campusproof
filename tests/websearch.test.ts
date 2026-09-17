import { describe, expect, it } from "vitest";
import { classifyDomain } from "@/lib/sources/classifyDomain";
import { withProvenance } from "@/lib/sources/webSearch";
import { planQueries } from "@/lib/sources/webSearch/queryPlan";
import { toCandidates } from "@/lib/sources/webSearch/serper";
import type { Candidate, UniversityEntity } from "@/lib/types";

const kazakh: UniversityEntity = {
  qid: "Q2783344",
  name: "Назарбаев Университет",
  names: { ru: "Назарбаев Университет", en: "Nazarbayev University", kk: "Назарбаев Университеті" },
  aliases: ["НУ", "NU"],
  country: "Казахстан",
  countryCode: "KZ",
  city: { name: "Астана" },
  domains: ["nu.edu.kz"],
  wikipedia: [],
};

const swiss: UniversityEntity = {
  ...kazakh,
  qid: "Q11942",
  name: "ETH Zurich",
  names: { en: "ETH Zurich", ru: "Высшая техническая школа Цюриха" },
  aliases: [],
  country: "Швейцария",
  countryCode: "CH",
  domains: ["ethz.ch"],
};

describe("planQueries", () => {
  it("spends the small query budget on the areas Commons does not cover", () => {
    const queries = planQueries(kazakh);
    expect(queries.length).toBeLessThanOrEqual(6);
    expect(queries.map((query) => query.categoryHint)).toEqual(
      expect.arrayContaining(["dormitory", "classroom", "library", "sports"]),
    );
    expect(queries.every((query) => query.countryCode === "kz")).toBe(true);
    expect(new Set(queries.map((query) => query.q)).size).toBe(queries.length);
  });

  it("asks in Russian first for Kazakhstan and in English first for Switzerland", () => {
    expect(planQueries(kazakh)[0]).toMatchObject({ lang: "ru", q: expect.stringContaining("Назарбаев Университет") });
    expect(planQueries(swiss)[0]).toMatchObject({ lang: "en", q: expect.stringContaining("ETH Zurich") });
  });

  it("adds one query restricted to the official site", () => {
    const site = planQueries(kazakh).find((query) => query.q.startsWith("site:"));
    expect(site?.q).toBe("site:nu.edu.kz Назарбаев Университет");
  });

  it("returns nothing when the entity has no usable name", () => {
    expect(planQueries({ ...kazakh, names: {}, domains: [] })).toEqual([]);
  });
});

describe("classifyDomain", () => {
  it("recognizes the university's own domain and its subdomains", () => {
    expect(classifyDomain("nu.edu.kz", kazakh).sourceType).toBe("official");
    expect(classifyDomain("www.news.nu.edu.kz", kazakh).sourceType).toBe("official");
  });

  it("labels encyclopedias, news, social networks, stock banks and the rest", () => {
    expect(classifyDomain("commons.wikimedia.org", kazakh).sourceType).toBe("encyclopedic");
    expect(classifyDomain("tengrinews.kz", kazakh).sourceType).toBe("news");
    expect(classifyDomain("instagram.com", kazakh).sourceType).toBe("social");
    expect(classifyDomain("shutterstock.com", kazakh)).toMatchObject({ sourceType: "unknown", isStock: true });
    expect(classifyDomain("pinterest.com", kazakh)).toMatchObject({ sourceType: "unknown", isAggregator: true });
    expect(classifyDomain("some-blog.kz", kazakh).sourceType).toBe("independent");
  });
});

describe("serper response mapping", () => {
  const query = {
    q: '"Nazarbayev University" dormitory',
    lang: "en",
    countryCode: "kz",
    categoryHint: "dormitory",
  } as const;

  it("maps rows to candidates and keeps the category hint", () => {
    const candidates = toCandidates(
      {
        images: [
          {
            title: "NU dormitory",
            imageUrl: "https://nu.edu.kz/img/dorm.jpg",
            thumbnailUrl: "https://serper.dev/thumb.jpg",
            imageWidth: 1200,
            imageHeight: 800,
            link: "https://www.nu.edu.kz/campus/housing",
            domain: "nu.edu.kz",
          },
        ],
      },
      query,
    );
    expect(candidates).toEqual([
      {
        imageUrl: "https://nu.edu.kz/img/dorm.jpg",
        thumbUrl: "https://serper.dev/thumb.jpg",
        sourcePageUrl: "https://www.nu.edu.kz/campus/housing",
        sourceDomain: "nu.edu.kz",
        provider: "serper",
        title: "NU dormitory",
        categoryHint: "dormitory",
        provenance: { sourceType: "unknown" },
        width: 1200,
        height: 800,
      },
    ]);
  });

  it("drops unusable rows and survives a changed response shape", () => {
    expect(toCandidates({ images: [{ title: "no urls" }, { imageUrl: "https://a/b.jpg" }] }, query)).toEqual([]);
    expect(toCandidates({}, query)).toEqual([]);
    expect(toCandidates(null, query)).toEqual([]);
  });
});

describe("withProvenance", () => {
  const candidate = (over: Partial<Candidate> = {}): Candidate => ({
    imageUrl: "https://example.kz/a.jpg",
    sourcePageUrl: "https://example.kz/page",
    sourceDomain: "example.kz",
    provider: "serper",
    provenance: { sourceType: "unknown" },
    ...over,
  });

  it("marks the official domain and pages that name the university", () => {
    const [official] = withProvenance(
      [candidate({ sourceDomain: "nu.edu.kz", sourcePageUrl: "https://nu.edu.kz/housing" })],
      kazakh,
      "site:nu.edu.kz Назарбаев Университет",
    );
    expect(official.provenance).toMatchObject({ sourceType: "official", officialDomain: true, pageMentionsName: true });

    const [news] = withProvenance(
      [candidate({ sourceDomain: "tengrinews.kz", title: "Новое общежитие Назарбаев Университета" })],
      kazakh,
      '"Назарбаев Университет" общежитие',
    );
    expect(news.provenance).toMatchObject({ sourceType: "news", pageMentionsName: true });

    const [stranger] = withProvenance([candidate({ title: "Просто фото города" })], kazakh, "запрос");
    expect(stranger.provenance).toEqual({ sourceType: "independent" });
  });
});
