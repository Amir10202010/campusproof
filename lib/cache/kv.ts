import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

/**
 * Shared cache helpers (Upstash Redis free tier) — READY to use by every lane:
 * P1 profile/resolve/Wikimedia caches, P2 search + vision observation caches, reuse index.
 * Not configured or Redis down → reads return null and writes do nothing. Never throws.
 * Keys: prefix by purpose, e.g. `profile:{version}:{qid}`, `search:serper:{hash}`, `vision:{model}:{qid}:{dHash}`.
 */
let client: Redis | null | undefined;

/**
 * Hard ceiling for one Redis round trip. The cache is an optimisation, never a dependency: a slow
 * Upstash must not eat the pipeline deadline. @upstash/redis otherwise retries 5 times with
 * exponential backoff (~11 s of waiting alone) and sends every request without an AbortSignal, so a
 * single stalled call could outlive LIMITS.GLOBAL_DEADLINE_MS. One retry within the budget is enough.
 */
const REDIS_TIMEOUT_MS = 1_000;

export function getRedis(): Redis | null {
  if (client === undefined) {
    client =
      env.upstashRedisUrl && env.upstashRedisToken
        ? new Redis({
            url: env.upstashRedisUrl,
            token: env.upstashRedisToken,
            // A factory, not a shared signal: every request needs its own timeout.
            signal: () => AbortSignal.timeout(REDIS_TIMEOUT_MS),
            retry: { retries: 1, backoff: () => 50 },
          })
        : null;
  }
  return client;
}

export async function kvGet<T>(key: string): Promise<T | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return (await redis.get<T>(key)) ?? null;
  } catch (error) {
    console.error(JSON.stringify({ at: "kvGet", key, error: String(error) }));
    return null;
  }
}

export async function kvSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, value, { ex: ttlSeconds });
  } catch (error) {
    console.error(JSON.stringify({ at: "kvSet", key, error: String(error) }));
  }
}
