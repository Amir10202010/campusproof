import { LIMITS } from "@/lib/config/limits";
import type { FetchedCandidate, RejectedItem } from "@/lib/types";
import { hammingDistance } from "./dhash";

/**
 * P2 · issue #17 · L1 exact (canonical URL / Commons file key) + L2 near-identical (dHash Hamming ≤
 * LIMITS.DHASH_NEAR_DUPLICATE_MAX_HAMMING). Representative: strongest provenance → resolution → has
 * date/license. Others → representative.alsoFoundAt + RejectedItem { reason: "duplicate", duplicateOf }.
 */
export type DedupeCandidates = (items: FetchedCandidate[]) => { kept: FetchedCandidate[]; rejected: RejectedItem[] };

/** At most this many "also found at" links per photo — the dialog stays readable. */
const MAX_ALSO_FOUND_AT = 8;

/** Who represents a cluster: provenance first, then resolution, then whether we know date and license. */
export function candidateStrength(item: FetchedCandidate): number {
  const { provenance: p } = item;
  let strength = 0;
  if (p.depictsQid) strength += 50;
  if (p.commonsCategoryMatch) strength += 40;
  if (p.usedOnWikipedia) strength += 30;
  if (p.officialDomain) strength += 30;
  if (p.pageMentionsName) strength += 10;
  if (item.geo) strength += 10;
  if (item.date) strength += 3;
  if (item.license) strength += 2;
  if (!item.lowRes) strength += 5;
  strength += Math.min(10, (item.prepared.width * item.prepared.height) / 1_000_000);
  return strength;
}

export const dedupeCandidates: DedupeCandidates = (items) => {
  const rejected: RejectedItem[] = [];
  const kept: FetchedCandidate[] = [];

  // Strongest first, so the representative of every cluster is the best copy we have.
  const ordered = [...items].sort((a, b) => candidateStrength(b) - candidateStrength(a));

  for (const item of ordered) {
    const twin = kept.find(
      (candidate) =>
        candidate.canonicalUrl === item.canonicalUrl ||
        hammingDistance(candidate.prepared.dHash, item.prepared.dHash) <= LIMITS.DHASH_NEAR_DUPLICATE_MAX_HAMMING,
    );

    if (!twin) {
      kept.push({ ...item, alsoFoundAt: [...item.alsoFoundAt] });
      continue;
    }

    // The same photo on another page is not noise: it is cross-source agreement.
    for (const mention of [
      { sourcePageUrl: item.sourcePageUrl, sourceDomain: item.sourceDomain },
      ...item.alsoFoundAt,
    ]) {
      const known =
        mention.sourcePageUrl === twin.sourcePageUrl ||
        twin.alsoFoundAt.some((entry) => entry.sourcePageUrl === mention.sourcePageUrl);
      if (!known && twin.alsoFoundAt.length < MAX_ALSO_FOUND_AT) twin.alsoFoundAt.push(mention);
    }

    rejected.push({
      ...(item.thumbUrl ? { thumbUrl: item.thumbUrl } : {}),
      sourcePageUrl: item.sourcePageUrl,
      reason: "duplicate",
      detail:
        item.canonicalUrl === twin.canonicalUrl
          ? "Тот же файл, что уже показан выше"
          : `Тот же снимок, что и с сайта ${twin.sourceDomain}`,
      duplicateOf: twin.id,
    });
  }

  return { kept, rejected };
};
