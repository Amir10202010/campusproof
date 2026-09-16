import type { Candidate, CategoryId } from "@/lib/types";

export interface SearchQuery {
  q: string;
  lang: "ru" | "en" | "kk";
  countryCode: string; // e.g. "kz" → Serper `gl`
  categoryHint?: CategoryId;
}

/** P2 · issue #16 · one implementation per provider (serper.ts, brave.ts). */
export interface WebImageSearchProvider {
  id: "serper" | "brave";
  search(query: SearchQuery, signal: AbortSignal): Promise<Candidate[]>;
}
