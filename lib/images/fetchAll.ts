import { notImplemented } from "@/lib/notImplemented";
import type { Candidate, FetchedCandidate, RejectedItem, RunContext } from "@/lib/types";

/**
 * P2 · issue #15 · canonicalize + drop exact URL duplicates → rank by a cheap prior (provenance,
 * source type, resolution, category diversity) → keep top LIMITS.VISION_MAX_IMAGES → safeFetchImage
 * with concurrency LIMITS.IMAGE_FETCH_CONCURRENCY (fallback: provider thumbnail → lowRes=true)
 * → prepareImage. Download failures become RejectedItem { reason: "fetch_failed" }.
 */
export type FetchCandidates = (
  candidates: Candidate[],
  ctx: RunContext,
) => Promise<{ fetched: FetchedCandidate[]; failed: RejectedItem[] }>;
export const fetchCandidates: FetchCandidates = async () => notImplemented("fetchCandidates", "P2", 15);
