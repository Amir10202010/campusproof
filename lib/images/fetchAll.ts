import { createHash } from "node:crypto";
import { LIMITS } from "@/lib/config/limits";
import { hostInList, STOCK_DOMAINS } from "@/lib/config/domains";
import type { Candidate, FetchedCandidate, RejectedItem, RunContext, SourceType } from "@/lib/types";
import { canonicalizeImageUrl } from "./canonicalize";
import { prepareImage } from "./prepare";
import { safeFetchImage } from "./safeFetch";

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

/** File types that are never a campus photo (docs/architecture.md §5.3). */
const NON_PHOTO_EXTENSION = /\.(?:svg|gif|ico|bmp|tiff?)(?:$|[?#])/i;

const SOURCE_TYPE_PRIOR: Record<SourceType, number> = {
  official: 10,
  encyclopedic: 8,
  news: 5,
  independent: 3,
  social: 1,
  unknown: 0,
};

/** How promising a candidate looks before we spend a download and a vision slot on it. */
export function candidatePrior(candidate: Candidate): number {
  const { provenance: p } = candidate;
  let prior = SOURCE_TYPE_PRIOR[p.sourceType] ?? 0;
  if (p.depictsQid) prior += 50;
  if (p.commonsCategoryMatch) prior += 40;
  if (p.usedOnWikipedia) prior += 30;
  if (p.officialDomain) prior += 30;
  if (p.pageMentionsName) prior += 10;
  if (candidate.geo) prior += 10;
  if (candidate.date) prior += 3;
  if (candidate.license) prior += 2;
  if (candidate.categoryHint) prior += 2;
  const pixels = (candidate.width ?? 0) * (candidate.height ?? 0);
  if (pixels >= 1_000_000) prior += 6;
  else if (pixels >= 400_000) prior += 3;
  return prior;
}

/** Strong provenance keeps a small image in the run (docs/architecture.md §5.3, step 5). */
function hasStrongProvenance(candidate: Candidate): boolean {
  const { provenance: p } = candidate;
  return Boolean(p.depictsQid || p.commonsCategoryMatch || p.usedOnWikipedia || p.officialDomain);
}

/**
 * Round-robin over category buckets so every required area gets candidates instead of 36 campus shots.
 * `items` must already be sorted best-first; each bucket keeps that order.
 */
export function selectWithQuotas<T>(items: T[], limit: number, keyOf: (item: T) => string): T[] {
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(item);
    else buckets.set(key, [item]);
  }

  const selected: T[] = [];
  while (selected.length < limit) {
    let added = false;
    for (const bucket of buckets.values()) {
      const next = bucket.shift();
      if (!next) continue;
      selected.push(next);
      added = true;
      if (selected.length >= limit) break;
    }
    if (!added) break;
  }
  return selected;
}

interface CandidateGroup {
  best: Candidate;
  prior: number;
  canonicalUrl: string;
  alsoFoundAt: { sourcePageUrl: string; sourceDomain: string }[];
}

function rejected(candidate: Candidate, reason: RejectedItem["reason"], detail: string): RejectedItem {
  return {
    ...(candidate.thumbUrl ? { thumbUrl: candidate.thumbUrl } : {}),
    sourcePageUrl: candidate.sourcePageUrl,
    reason,
    detail,
  };
}

/** Stock banks and non-photo file types never reach the download stage. */
function preReject(candidate: Candidate): RejectedItem | null {
  const host = hostOf(candidate.imageUrl);
  if (hostInList(candidate.sourceDomain, STOCK_DOMAINS) || (host && hostInList(host, STOCK_DOMAINS))) {
    return rejected(candidate, "stock_source", `Фотобанк: ${candidate.sourceDomain}`);
  }
  if (NON_PHOTO_EXTENSION.test(candidate.imageUrl)) {
    return rejected(candidate, "not_a_photo", "Это не фотография (векторный файл, GIF или иконка)");
  }
  return null;
}

function hostOf(url: string): string | null {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Runs `worker` over `items` with at most `limit` downloads in flight. */
async function runPool<T>(items: T[], limit: number, worker: (item: T) => Promise<void>): Promise<void> {
  let index = 0;
  const lanes = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) await worker(items[index++]);
  });
  await Promise.all(lanes);
}

export const fetchCandidates: FetchCandidates = async (candidates, ctx) => {
  const failed: RejectedItem[] = [];
  const groups = new Map<string, CandidateGroup>();

  for (const candidate of candidates) {
    const reject = preReject(candidate);
    if (reject) {
      failed.push(reject);
      continue;
    }
    const canonicalUrl = canonicalizeImageUrl(candidate.imageUrl);
    const prior = candidatePrior(candidate);
    const existing = groups.get(canonicalUrl);
    if (!existing) {
      groups.set(canonicalUrl, { best: candidate, prior, canonicalUrl, alsoFoundAt: [] });
      continue;
    }
    // Same file, another page: the stronger candidate leads, the other becomes a cross-source mention.
    const weaker = prior > existing.prior ? existing.best : candidate;
    if (prior > existing.prior) {
      existing.best = candidate;
      existing.prior = prior;
    }
    if (
      weaker.sourcePageUrl !== existing.best.sourcePageUrl &&
      !existing.alsoFoundAt.some((entry) => entry.sourcePageUrl === weaker.sourcePageUrl)
    ) {
      existing.alsoFoundAt.push({ sourcePageUrl: weaker.sourcePageUrl, sourceDomain: weaker.sourceDomain });
    }
  }

  const ranked = [...groups.values()].sort((a, b) => b.prior - a.prior);
  const selected = selectWithQuotas(ranked, LIMITS.VISION_MAX_IMAGES, (group) => group.best.categoryHint ?? "unknown");
  const fetched: FetchedCandidate[] = [];

  await runPool(selected, LIMITS.IMAGE_FETCH_CONCURRENCY, async (group) => {
    const candidate = group.best;
    if (ctx.signal.aborted || Date.now() >= ctx.deadlineAt) {
      failed.push(rejected(candidate, "verification_timeout", "Не успели загрузить до дедлайна"));
      return;
    }

    const thumbUrl = candidate.thumbUrl;
    let lowRes = false;
    let result: Awaited<ReturnType<typeof safeFetchImage>>;
    try {
      result = await safeFetchImage(candidate.imageUrl, ctx.signal);
    } catch (error) {
      // The original may be blocked or huge; the provider thumbnail still proves what is on the page.
      if (!thumbUrl || canonicalizeImageUrl(thumbUrl) === group.canonicalUrl) {
        failed.push(rejected(candidate, "fetch_failed", `Не удалось загрузить: ${message(error)}`));
        return;
      }
      try {
        result = await safeFetchImage(thumbUrl, ctx.signal);
        lowRes = true;
      } catch (thumbError) {
        failed.push(rejected(candidate, "fetch_failed", `Не удалось загрузить: ${message(thumbError)}`));
        return;
      }
    }

    let prepared;
    try {
      prepared = await prepareImage(result.buffer);
    } catch (error) {
      failed.push(rejected(candidate, "fetch_failed", `Не удалось обработать файл: ${message(error)}`));
      return;
    }

    const shortSide = Math.min(prepared.width, prepared.height);
    if (shortSide > 0 && shortSide < LIMITS.IMAGE_MIN_SHORT_SIDE_PX && !hasStrongProvenance(candidate)) {
      failed.push(
        rejected(candidate, "low_quality", `Слишком маленькое изображение: ${prepared.width}×${prepared.height}`),
      );
      return;
    }

    fetched.push({
      ...candidate,
      id: createHash("sha1").update(group.canonicalUrl).digest("hex").slice(0, 12),
      canonicalUrl: group.canonicalUrl,
      // The camera knows better than the page: EXIF fills in what the source did not tell us.
      geo: candidate.geo ?? prepared.exif?.gps,
      date: candidate.date ?? (prepared.exif?.takenAt ? { value: prepared.exif.takenAt, kind: "taken" } : undefined),
      prepared,
      lowRes,
      alsoFoundAt: group.alsoFoundAt,
    });
  });

  return { fetched, failed };
};

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
