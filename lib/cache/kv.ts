import { Redis } from "@upstash/redis";
import { env } from "@/lib/env";

/**
 * Shared cache helpers (Upstash Redis free tier) — READY to use by every lane:
 * P1 profile/resolve/Wikimedia caches, P2 search + vision observation caches, reuse index.
 * Not configured or Redis down → reads return null and writes do nothing. Never throws.
 * Keys: prefix by purpose, e.g. `profile:{version}:{qid}`, `search:serper:{hash}`, `vision:{model}:{qid}:{dHash}`.
 */
let client: Redis | null | undefined;

export function getRedis(): Redis | null {
  if (client === undefined) {
    client =
      env.upstashRedisUrl && env.upstashRedisToken
        ? new Redis({ url: env.upstashRedisUrl, token: env.upstashRedisToken })
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
