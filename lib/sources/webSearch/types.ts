import type { Candidate, CategoryId } from "@/lib/types";

export interface SearchQuery {
  q: string;
  lang: "ru" | "en" | "kk";
  countryCode: string; // e.g. "kz" → Serper `gl`
  categoryHint?: CategoryId;
}

/** P2 · issue #16 · free providers only (Serper: 2,500 free queries). Cache responses via lib/cache/kv.ts to save credits. */
export interface WebImageSearchProvider {
  id: "serper";
  search(query: SearchQuery, signal: AbortSignal): Promise<Candidate[]>;
}
