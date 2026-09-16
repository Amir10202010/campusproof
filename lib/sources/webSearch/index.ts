import { notImplemented } from "@/lib/notImplemented";
import type { Candidate, RunContext, UniversityEntity } from "@/lib/types";

/**
 * P2 · issue #16 · planQueries → provider.search in parallel (per-query timeout, respect ctx.signal)
 * → set provenance (classifyDomain, pageMentionsName) → merge. A failing query must not fail the gather.
 */
export type GatherWebSearch = (entity: UniversityEntity, ctx: RunContext) => Promise<Candidate[]>;
export const gatherWebSearch: GatherWebSearch = async () => notImplemented("gatherWebSearch", "P2", 16);
