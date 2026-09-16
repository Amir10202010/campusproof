import { notImplemented } from "@/lib/notImplemented";
import type { CandidateCard } from "@/lib/types";

/**
 * P1 · issue #7 · live Wikidata search (wbsearchentities in en + ru) via lib/sources/wikimediaFetch.ts.
 * Keep only higher-education institutions (P31 → Q38723 / Q3918, or a description that says so).
 */
export type SearchWikidata = (query: string, signal: AbortSignal) => Promise<CandidateCard[]>;
export const searchWikidata: SearchWikidata = async () => notImplemented("searchWikidata", "P1", 7);
