import { notImplemented } from "@/lib/notImplemented";

export interface SafeFetchResult {
  buffer: Buffer;
  contentType: string;
  finalUrl: string;
}

/**
 * P2 · issue #15 · SSRF-safe image download (docs/architecture.md §5.3, §9):
 * http/https only; reject IP literals, localhost and private ranges; ≤ LIMITS.IMAGE_FETCH_MAX_REDIRECTS
 * redirects (follow manually and re-check each hop); abort above LIMITS.IMAGE_FETCH_MAX_BYTES;
 * timeout LIMITS.IMAGE_FETCH_TIMEOUT_MS; content-type must be image/*.
 */
export type SafeFetchImage = (url: string, signal: AbortSignal) => Promise<SafeFetchResult>;
export const safeFetchImage: SafeFetchImage = async () => notImplemented("safeFetchImage", "P2", 15);
