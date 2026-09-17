import { kvGet, kvSet } from "@/lib/cache/kv";
import { LIMITS } from "@/lib/config/limits";
import { normalizeQuery } from "@/lib/resolver/normalize";
import { MAX_CARDS, searchWikidataRanked, toCandidateCards, type RankedCandidate } from "@/lib/resolver/wikidata";
import { buildUniversityEntity } from "@/lib/sources/wikidata";
import type { ResolveResult } from "@/lib/types";

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
  // not_found is not cached: a new Wikidata item or a better resolver (#14) should be picked up right away.
  if (result.status !== "not_found") await kvSet(cacheKey, result, LIMITS.RESOLVE_CACHE_TTL_S);
  return result;
};

/** Bump when resolution rules change, so stale cached answers are not served. */
const RESOLVER_VERSION = 1;

export function resolveCacheKey(normalizedQuery: string): string {
  return `resolve:v${RESOLVER_VERSION}:${normalizedQuery}`;
}

async function resolveLive(query: string, signal: AbortSignal): Promise<ResolveResult> {
  const ranked = await searchWikidataRanked(query, signal);
  switch (decide(ranked)) {
    case "resolved":
      return { status: "resolved", entity: await buildUniversityEntity(ranked[0].entity, signal) };
    case "ambiguous":
      return { status: "ambiguous", query, candidates: await toCandidateCards(ranked.slice(0, MAX_CARDS), signal) };
    case "not_found":
      return { status: "not_found", query, suggestions: [] };
  }
}

/** A leader must match a name well and be clearly ahead of the runner-up. */
export const MIN_MATCH_TO_RESOLVE = 0.6;
export const MIN_LEAD_TO_RESOLVE = 0.1;

export function decide(ranked: Pick<RankedCandidate, "match" | "score">[]): ResolveResult["status"] {
  const [top, second] = ranked;
  if (!top) return "not_found";
  if (top.match < MIN_MATCH_TO_RESOLVE) return "ambiguous";
  if (!second || top.score - second.score >= MIN_LEAD_TO_RESOLVE) return "resolved";
  return "ambiguous";
}
