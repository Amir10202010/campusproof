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
