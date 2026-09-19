import { getRedis } from "@/lib/cache/kv";
import { env } from "@/lib/env";
import type { UniversityProfile } from "@/lib/types";
import type { CommunityPhoto, PublicCommunityPhoto } from "./types";
import { toPublicPhoto } from "./types";

/**
 * Upstash storage for community photos (owner: P1 · community feature).
 * Keys: `community:photo:{qid}` — list of ids; `community:photo:item:{id}` — the object. TTL 30 days.
 * Redis missing or down → reads return empty, writes do nothing (never fails the request).
 */
const TTL_S = 30 * 24 * 3600;
const KNOWN_HASH_SAMPLE_PROFILES = 25;
const KNOWN_HASH_SAMPLE_OWN = 100;

const listKey = (qid: string) => `community:photo:${qid}`;
const itemKey = (id: string) => `community:photo:item:${id}`;

export async function savePhoto(photo: CommunityPhoto): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(itemKey(photo.id), photo, { ex: TTL_S });
    await redis.lpush(listKey(photo.qid), photo.id);
    await redis.expire(listKey(photo.qid), TTL_S);
  } catch (error) {
    console.error(JSON.stringify({ at: "community.savePhoto", error: String(error) }));
  }
}

export async function listPhotos(qid: string, limit = 30): Promise<PublicCommunityPhoto[]> {
  const redis = getRedis();
  if (!redis) return [];
  try {
    const ids = await redis.lrange<string>(listKey(qid), 0, limit - 1);
    if (ids.length === 0) return [];
    const items = await Promise.all(ids.map((id) => redis.get<CommunityPhoto>(itemKey(id))));
    return items.filter((p): p is CommunityPhoto => Boolean(p)).map(toPublicPhoto);
  } catch (error) {
    console.error(JSON.stringify({ at: "community.listPhotos", error: String(error) }));
    return [];
  }
}

/**
 * Best-effort dHash pool to catch reused/duplicate photos: this university's own community photos,
 * its cached pipeline profile, and a bounded sample of other cached profiles ("всех, до которых
 * дотянешься" — reachable, not exhaustive). Never throws; a Redis hiccup just means fewer known hashes.
 */
export async function collectKnownDHashes(qid: string): Promise<{ dHash: string; qid: string }[]> {
  const redis = getRedis();
  if (!redis) return [];
  const out: { dHash: string; qid: string }[] = [];
  try {
    const ownIds = await redis.lrange<string>(listKey(qid), 0, KNOWN_HASH_SAMPLE_OWN - 1);
    const own = await Promise.all(ownIds.map((id) => redis.get<CommunityPhoto>(itemKey(id))));
    for (const p of own) if (p) out.push({ dHash: p.dHash, qid: p.qid });

    const ownProfile = await redis.get<UniversityProfile>(`profile:${env.pipelineVersion}:${qid}`);
    for (const photo of ownProfile?.photos ?? []) out.push({ dHash: photo.dHash, qid });

    const keys = await redis.keys(`profile:${env.pipelineVersion}:*`);
    const sample = keys.filter((k) => !k.endsWith(`:${qid}`)).slice(0, KNOWN_HASH_SAMPLE_PROFILES);
    const others = await Promise.all(sample.map((k) => redis.get<UniversityProfile>(k)));
    for (const other of others) {
      if (!other?.entity?.qid) continue;
      for (const photo of other.photos ?? []) out.push({ dHash: photo.dHash, qid: other.entity.qid });
    }
  } catch (error) {
    console.error(JSON.stringify({ at: "community.collectKnownDHashes", error: String(error) }));
  }
  return out;
}
