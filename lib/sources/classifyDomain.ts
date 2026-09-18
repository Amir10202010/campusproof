import {
  AGGREGATOR_DOMAINS,
  ENCYCLOPEDIC_DOMAINS,
  hostInList,
  hostMatches,
  NEWS_DOMAINS,
  SOCIAL_DOMAINS,
  STOCK_DOMAINS,
} from "@/lib/config/domains";
import type { SourceType, UniversityEntity } from "@/lib/types";

export interface DomainClass {
  sourceType: SourceType;
  isStock: boolean;
  isAggregator: boolean;
}

/** P2 · issue #16 · uses lib/config/domains.ts lists + entity.domains (official). */
export type ClassifyDomain = (hostname: string, entity: UniversityEntity) => DomainClass;

export const classifyDomain: ClassifyDomain = (hostname, entity) => {
  const host = hostname.toLowerCase().replace(/^www\./, "");
  const isStock = hostInList(host, STOCK_DOMAINS);
  const isAggregator = hostInList(host, AGGREGATOR_DOMAINS);

  // The university's own domains come from Wikidata (P856), never from a hand-written list.
  const official = entity.domains.some((domain) => officialHosts(domain).some((own) => hostMatches(host, own)));

  const sourceType: SourceType = official
    ? "official"
    : hostInList(host, ENCYCLOPEDIC_DOMAINS)
      ? "encyclopedic"
      : hostInList(host, NEWS_DOMAINS)
        ? "news"
        : hostInList(host, SOCIAL_DOMAINS)
          ? "social"
          : isStock || isAggregator
            ? "unknown"
            : "independent";

  return { sourceType, isStock, isAggregator };
};

/** Second levels that only schools and universities can register under a country domain (edu.kz, ac.uk). */
const ACADEMIC_LEVELS = ["edu", "ac"];

/**
 * A domain from Wikidata plus its academic twin: "kbtu.kz" → also "kbtu.edu.kz". Wikidata often keeps the old
 * address after a university moves to edu.CC and redirects the old one there, so the site itself was not official.
 * Only one direction: a plain "name.CC" is not implied by "name.edu.CC", anyone may register it.
 */
export function officialHosts(domain: string): string[] {
  const clean = domain.toLowerCase().replace(/^www\./, "");
  const [name, countryCode, ...rest] = clean.split(".");
  if (rest.length > 0 || !name || !/^[a-z]{2}$/.test(countryCode ?? "")) return [clean];
  return [clean, ...ACADEMIC_LEVELS.map((level) => `${name}.${level}.${countryCode}`)];
}
