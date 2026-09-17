import { createHash } from "node:crypto";
import { kvGet, kvSet } from "@/lib/cache/kv";
import { LIMITS } from "@/lib/config/limits";
import { env } from "@/lib/env";
import type { Candidate } from "@/lib/types";
import type { SearchQuery, WebImageSearchProvider } from "./types";

/**
 * P2 · issue #16 · POST https://google.serper.dev/images  (header X-API-KEY = env.serperApiKey)
 * body { q, gl, hl, num } → images[] → Candidate (imageUrl, thumbnailUrl, link → sourcePageUrl, domain, title).
 * The free plan has 2,500 credits in total, so every response is cached for LIMITS.SEARCH_CACHE_TTL_S.
 */
const ENDPOINT = "https://google.serper.dev/images";
const RESULTS_PER_QUERY = 20;

/** One image row of the Serper response; every field is checked because the API may change. */
interface SerperImage {
  title?: unknown;
  imageUrl?: unknown;
  imageWidth?: unknown;
  imageHeight?: unknown;
  thumbnailUrl?: unknown;
  link?: unknown;
  domain?: unknown;
  source?: unknown;
}

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const size = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

/** Maps the response to candidates; rows without an image or a page URL are dropped. */
export function toCandidates(body: unknown, query: SearchQuery): Candidate[] {
  const images = (body as { images?: unknown })?.images;
  if (!Array.isArray(images)) return [];

  const candidates: Candidate[] = [];
  for (const row of images as SerperImage[]) {
    const imageUrl = text(row.imageUrl);
    const sourcePageUrl = text(row.link);
    if (!imageUrl || !sourcePageUrl) continue;
    const sourceDomain = hostOf(sourcePageUrl) ?? text(row.domain);
    if (!sourceDomain) continue;

    candidates.push({
      imageUrl,
      ...(text(row.thumbnailUrl) ? { thumbUrl: text(row.thumbnailUrl) } : {}),
      sourcePageUrl,
      sourceDomain,
      provider: "serper",
      ...(text(row.title) ? { title: text(row.title) } : {}),
      ...(query.categoryHint ? { categoryHint: query.categoryHint } : {}),
      // gatherWebSearch fills provenance in: it knows the university and the domain lists.
      provenance: { sourceType: "unknown" },
      ...(size(row.imageWidth) ? { width: size(row.imageWidth) } : {}),
      ...(size(row.imageHeight) ? { height: size(row.imageHeight) } : {}),
    });
  }
  return candidates;
}

export const serperProvider: WebImageSearchProvider = {
  id: "serper",
  async search(query, signal) {
    if (!env.serperApiKey) throw new Error("Веб-поиск не настроен: нет ключа SERPER_API_KEY");

    const cacheKey = `search:serper:${createHash("sha1")
      .update(`${query.q}|${query.countryCode}|${query.lang}`)
      .digest("hex")
      .slice(0, 16)}`;
    const cached = await kvGet<Candidate[]>(cacheKey);
    if (cached) return cached;

    const response = await fetch(ENDPOINT, {
      method: "POST",
      signal,
      headers: { "X-API-KEY": env.serperApiKey, "content-type": "application/json" },
      body: JSON.stringify({ q: query.q, gl: query.countryCode, hl: query.lang, num: RESULTS_PER_QUERY }),
    });
    if (!response.ok) throw new Error(`Serper ${response.status} for "${query.q}"`);

    const candidates = toCandidates(await response.json(), query);
    await kvSet(cacheKey, candidates, LIMITS.SEARCH_CACHE_TTL_S);
    return candidates;
  },
};
