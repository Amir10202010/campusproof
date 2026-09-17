import { LIMITS } from "@/lib/config/limits";
import { foldText } from "@/lib/resolver/normalize";
import { classifyDomain } from "@/lib/sources/classifyDomain";
import type { Candidate, RunContext, UniversityEntity } from "@/lib/types";
import { planQueries } from "./queryPlan";
import { serperProvider } from "./serper";

/**
 * P2 · issue #16 · planQueries → provider.search in parallel (per-query timeout, respect ctx.signal)
 * → set provenance (classifyDomain, pageMentionsName) → merge. A failing query must not fail the gather.
 */
export type GatherWebSearch = (entity: UniversityEntity, ctx: RunContext) => Promise<Candidate[]>;

export const gatherWebSearch: GatherWebSearch = async (entity, ctx) => {
  const queries = planQueries(entity);
  if (queries.length === 0) return [];

  const results = await Promise.allSettled(
    queries.map(async (query) => {
      const signal = AbortSignal.any([ctx.signal, AbortSignal.timeout(LIMITS.ADAPTER_TIMEOUT_MS)]);
      return withProvenance(await serperProvider.search(query, signal), entity, query.q);
    }),
  );

  // One dead query must not cost the whole source; all of them dead is a real failure.
  if (results.every((result) => result.status === "rejected")) {
    throw (results[0] as PromiseRejectedResult).reason;
  }

  const byImageUrl = new Map<string, Candidate>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const candidate of result.value) {
      if (!byImageUrl.has(candidate.imageUrl)) byImageUrl.set(candidate.imageUrl, candidate);
    }
  }
  return [...byImageUrl.values()];
};

/** Who published the image and whether the page itself names the university (docs/architecture.md §5.2). */
export function withProvenance(candidates: Candidate[], entity: UniversityEntity, query: string): Candidate[] {
  return candidates.map((candidate) => {
    const domain = classifyDomain(candidate.sourceDomain, entity);
    const mentions =
      pageMentionsUniversity(
        `${candidate.title ?? ""} ${candidate.caption ?? ""} ${candidate.sourcePageUrl}`,
        entity,
      ) ||
      // A `site:` query only returns pages of that site, so the university is implied by the domain.
      (domain.sourceType === "official" && query.includes("site:"));
    return {
      ...candidate,
      provenance: {
        sourceType: domain.sourceType,
        ...(domain.sourceType === "official" ? { officialDomain: true } : {}),
        ...(mentions ? { pageMentionsName: true } : {}),
      },
    };
  });
}

/**
 * Web pages inflect and glue names ("Назарбаев Университета", "nazarbayev-university"), so a long name counts
 * as a substring of the folded text, while a short alias ("НУ", "KBTU") must stand as its own word.
 */
export function pageMentionsUniversity(text: string, entity: UniversityEntity): boolean {
  const haystack = ` ${foldText(text)} `;
  const names = [entity.names.en, entity.names.ru, entity.names.kk, entity.name]
    .filter((name): name is string => Boolean(name))
    .map(foldText)
    .filter((name) => name.length >= 5);
  if (names.some((name) => haystack.includes(name))) return true;
  return entity.aliases
    .map(foldText)
    .filter((alias) => alias.length >= 3)
    .some((alias) => haystack.includes(` ${alias} `));
}
