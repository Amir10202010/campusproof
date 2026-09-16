import { notImplemented } from "@/lib/notImplemented";
import type { FetchedCandidate, RejectedItem } from "@/lib/types";

/**
 * P2 · issue #17 · L1 exact (canonical URL / Commons file key) + L2 near-identical (dHash Hamming ≤
 * LIMITS.DHASH_NEAR_DUPLICATE_MAX_HAMMING). Representative: strongest provenance → resolution → has
 * date/license. Others → representative.alsoFoundAt + RejectedItem { reason: "duplicate", duplicateOf }.
 */
export type DedupeCandidates = (items: FetchedCandidate[]) => { kept: FetchedCandidate[]; rejected: RejectedItem[] };
export const dedupeCandidates: DedupeCandidates = () => notImplemented("dedupeCandidates", "P2", 17);
