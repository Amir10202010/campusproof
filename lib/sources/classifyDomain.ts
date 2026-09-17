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
  const official = entity.domains.some((domain) => hostMatches(host, domain.toLowerCase().replace(/^www\./, "")));

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
