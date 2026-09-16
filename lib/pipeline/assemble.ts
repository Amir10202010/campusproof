import type { FetchedCandidate, Photo, RejectedItem, ScoreResult } from "@/lib/types";

/** Turns a scored candidate into what the UI renders: a Photo, or a RejectedItem with a reason. */
export function toPhotoOrRejected(
  candidate: FetchedCandidate,
  result: ScoreResult,
  retrievedAt: string,
): { photo: Photo } | { rejected: RejectedItem } {
  if (result.reject || result.tier === "rejected") {
    return {
      rejected: {
        thumbUrl: result.reject?.reason === "portrait" ? undefined : (candidate.thumbUrl ?? candidate.imageUrl),
        sourcePageUrl: candidate.sourcePageUrl,
        reason: result.reject?.reason ?? "low_score",
        detail: result.reject?.detail ?? `Недостаточно доказательств (${result.points} б.)`,
      },
    };
  }

  return {
    photo: {
      id: candidate.id,
      imageUrl: candidate.imageUrl,
      thumbUrl: candidate.thumbUrl ?? candidate.imageUrl,
      width: candidate.width ?? candidate.prepared.width,
      height: candidate.height ?? candidate.prepared.height,
      sourcePageUrl: candidate.sourcePageUrl,
      sourceDomain: candidate.sourceDomain,
      sourceType: candidate.provenance.sourceType,
      provider: candidate.provider,
      title: candidate.title,
      date: candidate.date,
      retrievedAt,
      license: candidate.license,
      geo: candidate.geo,
      category: result.category,
      secondary: result.secondary,
      tier: result.tier,
      points: result.points,
      evidence: result.evidence,
      labels: result.labels,
      alsoFoundAt: candidate.alsoFoundAt,
      dHash: candidate.prepared.dHash,
    },
  };
}
