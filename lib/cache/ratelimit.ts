import { notImplemented } from "@/lib/notImplemented";

/**
 * P1 · issue #13 · @upstash/ratelimit: fresh (non-cached) runs per client (20 / 10 min)
 * + a global daily counter (MAX_FRESH_PROFILES_PER_DAY). Cached views are never limited.
 */
export type AllowFreshRun = (clientKey: string) => Promise<{ allowed: boolean; reason?: string }>;
export const allowFreshRun: AllowFreshRun = async () => notImplemented("allowFreshRun", "P1", 13);
