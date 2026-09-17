import { CATEGORIES } from "@/lib/config/categories";
import { LIMITS } from "@/lib/config/limits";
import type { CategoryId, UniversityEntity } from "@/lib/types";
import type { SearchQuery } from "./types";

/**
 * P2 · issue #16 · ≤ LIMITS.WEB_SEARCH_MAX_QUERIES queries from lib/config/categories.ts templates
 * (en/ru/kk names from the entity) + `site:<official domain>` queries. Use the S3 findings (docs/spikes.md).
 */
export type PlanQueries = (entity: UniversityEntity) => SearchQuery[];

/** Where Russian is the working language of the web: ask in Russian first. */
const RU_FIRST = new Set(["KZ", "RU", "KG", "UZ", "TJ", "TM", "BY", "AM", "AZ", "GE", "MD", "UA"]);

/**
 * Commons usually covers the campus and the city well, but almost never dormitories, classrooms,
 * libraries or sports halls — so the few paid-free search queries we have go to those areas first.
 */
const THIN_AREAS: CategoryId[] = ["dormitory", "classroom", "library", "sports"];

function nameFor(entity: UniversityEntity, lang: SearchQuery["lang"]): string | undefined {
  if (lang === "ru") return entity.names.ru ?? entity.names.en;
  if (lang === "kk") return entity.names.kk;
  return entity.names.en ?? entity.names.ru;
}

function templateFor(category: CategoryId, lang: SearchQuery["lang"]): string | undefined {
  return CATEGORIES.find((entry) => entry.id === category)?.queries[lang]?.[0];
}

export const planQueries: PlanQueries = (entity) => {
  const primary: SearchQuery["lang"] = RU_FIRST.has(entity.countryCode.toUpperCase()) ? "ru" : "en";
  const secondary: SearchQuery["lang"] = primary === "ru" ? "en" : "ru";
  const countryCode = entity.countryCode.toLowerCase();
  const queries: SearchQuery[] = [];

  const push = (q: string | undefined, lang: SearchQuery["lang"], categoryHint?: CategoryId) => {
    const text = q?.trim();
    if (!text || queries.some((query) => query.q === text)) return;
    queries.push({ q: text, lang, countryCode, ...(categoryHint ? { categoryHint } : {}) });
  };

  const fill = (lang: SearchQuery["lang"]) => {
    const name = nameFor(entity, lang);
    if (!name) return;
    for (const area of THIN_AREAS) push(templateFor(area, lang)?.replace("{name}", name), lang, area);
  };

  fill(primary);
  // The official site is the best source for the areas the encyclopedias miss.
  const domain = entity.domains[0];
  const officialName = nameFor(entity, primary);
  if (domain && officialName) push(`site:${domain} ${stripQuotes(officialName)}`, primary, "campus");
  fill(secondary);

  return queries.slice(0, LIMITS.WEB_SEARCH_MAX_QUERIES);
};

function stripQuotes(name: string): string {
  return name.replace(/["«»]/g, "").trim();
}
