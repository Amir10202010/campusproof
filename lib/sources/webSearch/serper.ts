import { createHash } from "node:crypto";
import { kvGet, kvSet } from "@/lib/cache/kv";
import { LIMITS } from "@/lib/config/limits";
import { env } from "@/lib/env";
import type { Candidate } from "@/lib/types";
import type { SearchQuery, WebImageSearchProvider } from "./types";

/**
 * P2 · issue #16 · POST https://google.serper.dev/images  (header X-API-KEY = env.serperApiKey)
 * body { q, gl, hl } → images[] → Candidate (imageUrl, thumbnailUrl, link → sourcePageUrl, domain, title).
 * The free plan has 2,500 credits in total, so every response is cached for LIMITS.SEARCH_CACHE_TTL_S.
 *
 * Locale handling (#83): Serper answered HTTP 400 to every localized request while the same query without
 * `gl`/`hl` worked. So a 400 is retried once with the bare query and this instance keeps using that shape —
 * one wasted credit per instance instead of a dead source.
 */
const ENDPOINT = "https://google.serper.dev/images";

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

/** Set once per instance when Serper rejects localized requests (see the note above). */
let localeRejected = false;

/** Test hook: forget what this instance learned about the accepted request shape. */
export function resetSerperRequestShape() {
  localeRejected = false;
}

async function askSerper(query: SearchQuery, apiKey: string, signal: AbortSignal, localized: boolean) {
  const body = localized ? { q: query.q, gl: query.countryCode, hl: query.lang } : { q: query.q };
  const response = await fetch(ENDPOINT, {
    method: "POST",
    signal,
    headers: { "X-API-KEY": apiKey, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return response;
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

    // Serper rejected every localized request with 400 while the same query without gl/hl worked (#83),
    // so a 400 is retried once with the bare query and this instance keeps the shape that works.
    let response = await askSerper(query, env.serperApiKey, signal, !localeRejected);
    if (response.status === 400 && !localeRejected) {
      localeRejected = true;
      response = await askSerper(query, env.serperApiKey, signal, false);
    }
    if (!response.ok) {
      // Serper's own message is the only way to tell a bad key (403) from a bad parameter (400).
      const detail = (await response.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200).trim();
      throw new Error(`Serper ответил HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
    }

    const candidates = toCandidates(await response.json(), query);
    await kvSet(cacheKey, candidates, LIMITS.SEARCH_CACHE_TTL_S);
    return candidates;
  },
};
