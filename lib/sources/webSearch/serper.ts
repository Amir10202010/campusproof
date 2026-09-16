import { notImplemented } from "@/lib/notImplemented";
import type { WebImageSearchProvider } from "./types";

/**
 * P2 · issue #16 · POST https://google.serper.dev/images  (header X-API-KEY = env.serperApiKey)
 * body { q, gl, hl, num } → images[] → Candidate (imageUrl, thumbnailUrl, link → sourcePageUrl, domain, title).
 */
export const serperProvider: WebImageSearchProvider = {
  id: "serper",
  search: async () => notImplemented("serperProvider.search", "P2", 16),
};
