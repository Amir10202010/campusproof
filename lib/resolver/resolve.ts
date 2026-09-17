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
  if (!normalizeQuery(trimmed)) return { status: "not_found", query: trimmed, suggestions: [] };

  const bounded = AbortSignal.any([signal, AbortSignal.timeout(LIMITS.RESOLVE_TIMEOUT_MS)]);
  const ranked = await searchWikidataRanked(trimmed, bounded);

  switch (decide(ranked)) {
    case "resolved":
      return { status: "resolved", entity: await buildUniversityEntity(ranked[0].entity, bounded) };
    case "ambiguous":
      return {
        status: "ambiguous",
        query: trimmed,
        candidates: await toCandidateCards(ranked.slice(0, MAX_CARDS), bounded),
      };
    case "not_found":
      return { status: "not_found", query: trimmed, suggestions: [] };
  }
};

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
