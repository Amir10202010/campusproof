import { describe, expect, it } from "vitest";
import { cyrillicToLatin, latinToCyrillic, normalizeQuery, queryVariants } from "@/lib/resolver/normalize";

describe("normalizeQuery", () => {
  it("lowercases, strips punctuation and collapses spaces", () => {
    expect(normalizeQuery("  Al-Farabi   Kazakh National, University!! ")).toBe("al farabi kazakh national");
  });

  it("folds Kazakh letters and diacritics", () => {
    expect(normalizeQuery("Қазақ ұлттық университеті")).toBe("казак улттык");
    expect(normalizeQuery("Әл-Фараби атындағы ҚазҰУ")).toBe("ал фараби атындагы казуу");
    expect(normalizeQuery("Université de Genève")).toBe("universite de geneve");
    expect(normalizeQuery("Ёлка Йошкар-Ола")).toBe("елка иошкар ола");
  });

  it("applies NFKC (full-width and compatibility characters)", () => {
    expect(normalizeQuery("ＫＢＴＵ")).toBe("kbtu");
  });

  it("removes filler words in Russian, Kazakh and English", () => {
    expect(normalizeQuery("Nazarbayev University")).toBe("nazarbayev");
    expect(normalizeQuery("Назарбаев Университеті")).toBe("назарбаев");
    expect(normalizeQuery("университет Сатпаева")).toBe("сатпаева");
    expect(normalizeQuery("uni of Cambridge")).toBe("of cambridge");
  });

  it("keeps filler words when nothing else is left", () => {
    expect(normalizeQuery("University")).toBe("university");
    expect(normalizeQuery("   ")).toBe("");
  });
});

describe("transliteration", () => {
  it("converts Cyrillic to Latin", () => {
    expect(cyrillicToLatin("казну")).toBe("kaznu");
    expect(cyrillicToLatin("жетысу щучинск")).toBe("zhetysu shchuchinsk");
  });

  it("converts Latin to Cyrillic with digraphs and a contextual y", () => {
    expect(latinToCyrillic("kbtu")).toBe("кбту");
    expect(latinToCyrillic("zhetysu")).toBe("жетысу");
    expect(latinToCyrillic("kyzylorda")).toBe("кызылорда");
    expect(latinToCyrillic("nazarbayev")).toBe("назарбайев");
  });
});

describe("queryVariants", () => {
  it("returns the normalized query and a folded transliteration", () => {
    expect(queryVariants("KazNU")).toEqual(["kaznu", "казну"]);
    expect(queryVariants("КБТУ")).toEqual(["кбту", "kbtu"]);
    expect(queryVariants("Nazarbayev University")).toEqual(["nazarbayev", "назарбаиев"]);
  });

  it("deduplicates and drops empty variants", () => {
    expect(queryVariants("2026")).toEqual(["2026"]);
    expect(queryVariants("!!!")).toEqual([]);
  });
});
