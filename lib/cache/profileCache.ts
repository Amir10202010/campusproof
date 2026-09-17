import { kvGet, kvSet } from "@/lib/cache/kv";
import { LIMITS } from "@/lib/config/limits";
import { env } from "@/lib/env";
import type { UniversityProfile } from "@/lib/types";

/**
 * P1 · issue #12 · Upstash Redis. Key: `profile:{PIPELINE_VERSION}:{qid}`, TTL LIMITS.PROFILE_CACHE_TTL_S.
 * If Redis is not configured or down → return null / do nothing (never fail the request).
 * The orchestrator saves only complete, non-degraded profiles; the cached copy keeps its original
 * `generatedAt` and `timings.totalMs`, so the UI labels it honestly as a saved profile.
 */
export type GetCachedProfile = (qid: string) => Promise<UniversityProfile | null>;
export type SaveProfile = (profile: UniversityProfile) => Promise<void>;

export function profileCacheKey(qid: string): string {
  return `profile:${env.pipelineVersion}:${qid}`;
}

export const getCachedProfile: GetCachedProfile = async (qid) => {
  const profile = await kvGet<UniversityProfile>(profileCacheKey(qid));
  // A profile from another pipeline version is never served (the key already contains the version).
  return profile && profile.entity?.qid === qid ? profile : null;
};

export const saveProfile: SaveProfile = async (profile) => {
  if (profile.degraded.length > 0) return;
  await kvSet(profileCacheKey(profile.entity.qid), profile, LIMITS.PROFILE_CACHE_TTL_S);
};
