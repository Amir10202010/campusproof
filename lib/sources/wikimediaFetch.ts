import { env } from "@/lib/env";

/**
 * The ONLY way to call Wikimedia APIs (Wikidata, Wikipedia, Commons) from this app.
 *
 * Wikimedia's 2026 rate limits: ~10 req/min without an identifying User-Agent,
 * 200 req/min with a compliant one. See docs/architecture.md §2.
 * Also: batch requests, cache results, stay under LIMITS.WIKIMEDIA_MAX_CALLS_PER_PROFILE.
 */
export async function wikimediaFetch(
  input: string | URL,
  init: RequestInit & { maxRetryAfterMs?: number } = {},
): Promise<Response> {
  const { maxRetryAfterMs = 3_000, headers, ...rest } = init;
  const merged = new Headers(headers);
  merged.set("User-Agent", env.wikimediaUserAgent);
  merged.set("Api-User-Agent", env.wikimediaUserAgent);
  if (!merged.has("Accept")) merged.set("Accept", "application/json");

  const response = await fetch(input, { ...rest, headers: merged });
  if (response.status !== 429) return response;

  // Honor Retry-After once if it is short; otherwise let the caller degrade gracefully.
  const retryAfterS = Number(response.headers.get("Retry-After") ?? "");
  const waitMs = Number.isFinite(retryAfterS) ? retryAfterS * 1000 : Infinity;
  if (waitMs > maxRetryAfterMs) return response;

  await new Promise((resolve) => setTimeout(resolve, waitMs));
  return fetch(input, { ...rest, headers: merged });
}

export class WikimediaError extends Error {
  readonly status: number;

  constructor(host: string, status: number, detail?: string) {
    super(`Wikimedia API ${host} failed: ${status}${detail ? ` ${detail}` : ""}`);
    this.name = "WikimediaError";
    this.status = status;
  }
}

export type WikimediaParams = Record<string, string | number | undefined>;

/** Builds a MediaWiki Action API URL (`https://{host}/w/api.php`, JSON, formatversion 2). */
export function wikimediaApiUrl(host: string, params: WikimediaParams): URL {
  const url = new URL(`https://${host}/w/api.php`);
  url.searchParams.set("format", "json");
  url.searchParams.set("formatversion", "2");
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url;
}

/**
 * Calls the MediaWiki Action API through wikimediaFetch and returns the parsed body.
 * HTTP errors and API-level `error` objects throw WikimediaError: callers degrade, never crash the request.
 */
export async function wikimediaApi<T>(host: string, params: WikimediaParams, signal: AbortSignal): Promise<T> {
  const url = wikimediaApiUrl(host, params);
  const response = await wikimediaFetch(url, { signal });
  if (!response.ok) throw new WikimediaError(host, response.status);
  const body = (await response.json()) as T & { error?: { code?: string } };
  if (body.error) throw new WikimediaError(host, response.status, body.error.code);
  return body;
}
