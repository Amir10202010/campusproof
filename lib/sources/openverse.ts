import { LIMITS } from "@/lib/config/limits";
import { env } from "@/lib/env";
import { classifyDomain } from "@/lib/sources/classifyDomain";
import { pageMentionsUniversity } from "@/lib/sources/webSearch";
import type { Candidate, RunContext, UniversityEntity } from "@/lib/types";

/**
 * P2 · issue #33 · FREE CC-licensed photos (incl. Flickr) from https://api.openverse.org/v1/
 * Anonymous access is allowed (20 requests/min, 200/day); with OPENVERSE_CLIENT_ID / OPENVERSE_CLIENT_SECRET
 * the app asks for an OAuth2 client_credentials token and gets the higher limits.
 * Search by the university names, keep rows whose title or tags name it, map landing URL, creator and license.
 */
export type GatherOpenverse = (entity: UniversityEntity, ctx: RunContext) => Promise<Candidate[]>;

const API = "https://api.openverse.org/v1";
/** Anonymous requests are limited to 20 results per page. */
const PAGE_SIZE = 20;
const PHOTO_FILETYPES = new Set(["jpg", "jpeg", "png", "webp", "tiff"]);

interface OpenverseRow {
  title?: string;
  url?: string;
  thumbnail?: string;
  foreign_landing_url?: string;
  creator?: string;
  license?: string;
  license_version?: string;
  license_url?: string;
  filetype?: string;
  width?: number;
  height?: number;
  mature?: boolean;
  tags?: { name?: string }[];
}

export const gatherOpenverse: GatherOpenverse = async (entity, ctx) => {
  const queries = [entity.names.en ?? entity.name, entity.names.ru, entity.names.kk]
    .filter((name): name is string => Boolean(name?.trim()))
    .filter((name, index, all) => all.indexOf(name) === index)
    .slice(0, LIMITS.OPENVERSE_MAX_QUERIES);
  if (queries.length === 0) return [];

  const token = await accessToken(ctx.signal).catch(() => undefined);
  const results = await Promise.allSettled(queries.map((query) => search(query, token, ctx.signal)));
  if (results.every((result) => result.status === "rejected")) {
    throw (results[0] as PromiseRejectedResult).reason;
  }

  const byImageUrl = new Map<string, Candidate>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const row of result.value) {
      const candidate = toCandidate(row, entity);
      if (candidate && !byImageUrl.has(candidate.imageUrl)) byImageUrl.set(candidate.imageUrl, candidate);
    }
  }
  return [...byImageUrl.values()];
};

async function search(query: string, token: string | undefined, signal: AbortSignal): Promise<OpenverseRow[]> {
  const url = new URL(`${API}/images/`);
  url.searchParams.set("q", query);
  url.searchParams.set("page_size", String(PAGE_SIZE));
  url.searchParams.set("mature", "false");
  const response = await fetch(url, {
    signal,
    headers: {
      accept: "application/json",
      "user-agent": env.wikimediaUserAgent,
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!response.ok) {
    const detail = response.status === 429 ? " (лимит запросов)" : "";
    throw new Error(`Openverse ответил HTTP ${response.status}${detail}`);
  }
  const body = (await response.json()) as { results?: OpenverseRow[] };
  return body.results ?? [];
}

/** Rows that are not photos, are tiny, or do not name the university are dropped before scoring. */
export function toCandidate(row: OpenverseRow, entity: UniversityEntity): Candidate | null {
  const imageUrl = row.url?.trim();
  const sourcePageUrl = row.foreign_landing_url?.trim();
  if (!imageUrl || !sourcePageUrl || row.mature) return null;
  if (row.filetype && !PHOTO_FILETYPES.has(row.filetype.toLowerCase())) return null;
  const short = Math.min(row.width ?? 0, row.height ?? 0);
  if (short > 0 && short < LIMITS.IMAGE_MIN_SHORT_SIDE_PX) return null;

  const sourceDomain = hostOf(sourcePageUrl);
  if (!sourceDomain) return null;
  const tags = (row.tags ?? []).map((tag) => tag.name).filter(Boolean) as string[];
  const text = [row.title, ...tags].filter(Boolean).join(" ");
  // Openverse ranks by relevance, not by binding: a photo that never names the university is not evidence.
  if (!pageMentionsUniversity(text, entity)) return null;

  const domain = classifyDomain(sourceDomain, entity);
  if (domain.isStock || domain.isAggregator) return null;

  return {
    imageUrl,
    ...(row.thumbnail ? { thumbUrl: row.thumbnail } : {}),
    sourcePageUrl,
    sourceDomain,
    provider: "openverse",
    ...(row.title ? { title: row.title } : {}),
    provenance: {
      sourceType: domain.sourceType,
      ...(domain.sourceType === "official" ? { officialDomain: true } : {}),
      pageMentionsName: true,
    },
    ...(license(row) ? { license: license(row) } : {}),
    ...(row.width ? { width: row.width } : {}),
    ...(row.height ? { height: row.height } : {}),
  };
}

function license(row: OpenverseRow): Candidate["license"] | undefined {
  if (!row.license) return undefined;
  const name = `CC ${row.license.toUpperCase()}${row.license_version ? ` ${row.license_version}` : ""}`;
  return {
    name,
    ...(row.license_url ? { url: row.license_url } : {}),
    ...(row.creator ? { author: row.creator } : {}),
  };
}

function hostOf(url: string): string | undefined {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return undefined;
  }
}

let cachedToken: { value: string; expiresAt: number } | undefined;

/** Test hook: forget the cached OAuth token. */
export function resetOpenverseToken() {
  cachedToken = undefined;
}

/** OAuth2 client_credentials — only when both keys are configured; otherwise anonymous limits apply. */
async function accessToken(signal: AbortSignal): Promise<string | undefined> {
  const { openverseClientId: id, openverseClientSecret: secret } = env;
  if (!id || !secret) return undefined;
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;

  const response = await fetch(`${API}/auth_tokens/token/`, {
    method: "POST",
    signal,
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "client_credentials", client_id: id, client_secret: secret }),
  });
  if (!response.ok) throw new Error(`Openverse не выдал токен: HTTP ${response.status}`);
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) return undefined;
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 3600) * 1000 - 60_000 };
  return cachedToken.value;
}
