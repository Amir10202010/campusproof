import { kvGet, kvSet } from "@/lib/cache/kv";
import { LIMITS } from "@/lib/config/limits";
import { indexCard, indexEntity, indexTerms, searchIndex } from "@/lib/resolver/indexSearch";
import { normalizeQuery, queryVariants } from "@/lib/resolver/normalize";
import {
  fuzzySimilarity,
  MAX_CARDS,
  matchQuality,
  MIN_FUZZY_SIMILARITY,
  popularityOf,
  searchWikidataDetailed,
  suggestWikidata,
  toCandidateCards,
  type RankedCandidate,
} from "@/lib/resolver/wikidata";
import { buildUniversityEntity } from "@/lib/sources/wikidata";
import type { CandidateCard, ResolveResult } from "@/lib/types";

/**
 * P1 · issue #7 (v0: Wikidata) → issue #14 (v1: local index first, Wikidata fallback).
 * One clear leader → "resolved"; several close candidates → "ambiguous" (≤6 cards);
 * nothing → "not_found" with suggestions. Timeout: LIMITS.RESOLVE_TIMEOUT_MS.
 */
export type ResolveQuery = (query: string, signal: AbortSignal) => Promise<ResolveResult>;

export const resolveQuery: ResolveQuery = async (query, signal) => {
  const trimmed = query.trim().slice(0, LIMITS.QUERY_MAX_LENGTH);
  const normalized = normalizeQuery(trimmed);
  if (!normalized) return { status: "not_found", query: trimmed, suggestions: [] };

  const cacheKey = resolveCacheKey(normalized);
  const cached = await kvGet<ResolveResult>(cacheKey);
  if (cached) return cached.status === "resolved" ? cached : { ...cached, query: trimmed };

  const bounded = AbortSignal.any([signal, AbortSignal.timeout(LIMITS.RESOLVE_TIMEOUT_MS)]);
  const result = await resolveLive(trimmed, bounded);
  // not_found lives shorter: a new Wikidata item should be picked up within a day.
  const ttl = result.status === "not_found" ? LIMITS.WIKIMEDIA_CACHE_TTL_S : LIMITS.RESOLVE_CACHE_TTL_S;
  await kvSet(cacheKey, result, ttl);
  return result;
};

/**
 * Bump when resolution rules change, so stale cached answers are not served.
 * v4 (#109): #64 and #101 changed the rules (higher-education filter, typed abbreviations) but kept v3,
 * so Redis still answered "ЕНУ" with the not_found it cached before those fixes — for up to 24 h.
 */
const RESOLVER_VERSION = 4;

export function resolveCacheKey(normalizedQuery: string): string {
  return `resolve:v${RESOLVER_VERSION}:${normalizedQuery}`;
}

async function resolveLive(query: string, signal: AbortSignal): Promise<ResolveResult> {
  // v1 (#14): the local index first — instant, no Wikimedia calls, Kazakh/Russian aliases from P3's build.
  const fromIndex = resolveFromIndex(query);
  if (fromIndex) return fromIndex;

  let found: Awaited<ReturnType<typeof searchWikidataDetailed>>;
  try {
    found = await searchWikidataDetailed(query, signal);
  } catch (error) {
    // Wikidata down or slow: weak index matches are still honest suggestions.
    const suggestions = indexSuggestions(query, false);
    if (suggestions.length > 0) return { status: "not_found", query, suggestions };
    throw error;
  }
  const { ranked, otherIds } = found;
  switch (decide(ranked)) {
    case "resolved":
      return { status: "resolved", entity: await buildUniversityEntity(ranked[0].entity, signal) };
    case "ambiguous":
      return { status: "ambiguous", query, candidates: await toCandidateCards(ranked.slice(0, MAX_CARDS), signal) };
    case "not_found": {
      const suggestions = await suggestWikidata(query, otherIds, signal)
        .then((suggested) => toCandidateCards(suggested, signal))
        .catch(() => []);
      return {
        status: "not_found",
        query,
        suggestions: suggestions.length > 0 ? suggestions : indexSuggestions(query, true),
      };
    }
  }
}

/**
 * Index hits count only when a name really matches (≥ MIN_MATCH_TO_RESOLVE). Weak or fuzzy-only hits fall through
 * to live Wikidata, which also knows universities outside the index (e.g. a new one or a small college).
 */
export function resolveFromIndex(query: string): ResolveResult | null {
  const variants = queryVariants(query);
  const strong = searchIndex(query)
    .map(({ entry }) => {
      const match = matchQuality(variants, indexTerms(entry));
      const popularity = popularityOf(entry.sitelinks);
      // Index entries always carry data (P3 builds them from Wikidata with coordinates, Commons and sitelinks).
      return { entry, match, popularity, stub: false, score: 0.7 * match + 0.3 * popularity };
    })
    .filter((candidate) => candidate.match >= MIN_MATCH_TO_RESOLVE)
    .sort((a, b) => b.score - a.score);
  if (strong.length === 0) return null;
  return decide(strong) === "resolved"
    ? { status: "resolved", entity: indexEntity(strong[0].entry) }
    : { status: "ambiguous", query, candidates: strong.slice(0, MAX_CARDS).map((c) => indexCard(c.entry)) };
}

/** Fuzzy/partial index hits as pick-list cards — never auto-selected. `closeOnly` drops hits with dissimilar names. */
export function indexSuggestions(query: string, closeOnly: boolean): CandidateCard[] {
  const variants = queryVariants(query);
  return searchIndex(query)
    .filter(({ entry }) => !closeOnly || fuzzySimilarity(variants, indexTerms(entry)) >= MIN_FUZZY_SIMILARITY)
    .slice(0, MAX_CARDS)
    .map(({ entry }) => indexCard(entry));
}

/** A leader must match a name well and be clearly ahead of the runner-up. */
export const MIN_MATCH_TO_RESOLVE = 0.6;
export const MIN_LEAD_TO_RESOLVE = 0.1;

/** An exact name or alias match (≥ EXACT_MATCH) beats partial matches regardless of popularity. */
export const EXACT_MATCH = 0.95;

export function decide(
  ranked: (Pick<RankedCandidate, "match" | "score"> & { stub?: boolean })[],
): ResolveResult["status"] {
  const [top, second] = ranked;
  if (!top) return "not_found";
  if (top.match < MIN_MATCH_TO_RESOLVE) return "ambiguous";
  // An item with no article, no Commons category and no coordinates is auto-selected only on an exact name,
  // and never just because the name is exact: an empty Wikidata duplicate must not beat a documented university (#86).
  if (top.stub && top.match < EXACT_MATCH) return "ambiguous";
  if (!second || top.score - second.score >= MIN_LEAD_TO_RESOLVE) return "resolved";
  if (top.match >= EXACT_MATCH && second.match < EXACT_MATCH && !top.stub) return "resolved";
  return "ambiguous";
}
