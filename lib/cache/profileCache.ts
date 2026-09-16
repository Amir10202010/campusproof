import { notImplemented } from "@/lib/notImplemented";
import type { UniversityProfile } from "@/lib/types";

/**
 * P1 · issue #12 · Upstash Redis. Key: `profile:{PIPELINE_VERSION}:{qid}`, TTL LIMITS.PROFILE_CACHE_TTL_S.
 * If Redis is not configured or down → return null / do nothing (never fail the request).
 */
export type GetCachedProfile = (qid: string) => Promise<UniversityProfile | null>;
export const getCachedProfile: GetCachedProfile = async () => notImplemented("getCachedProfile", "P1", 12);

export type SaveProfile = (profile: UniversityProfile) => Promise<void>;
export const saveProfile: SaveProfile = async () => notImplemented("saveProfile", "P1", 12);
