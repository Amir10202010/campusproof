import { notImplemented } from "@/lib/notImplemented";
import type { UniversityIndexEntry } from "@/lib/types";

/**
 * P1 · issue #14 · MiniSearch over data/universities.min.json (built by P3, issue #24):
 * names + aliases, fuzzy ~0.2, prefix search, boosted by sitelinks. Load the index once per instance.
 */
export type SearchIndex = (query: string) => { entry: UniversityIndexEntry; score: number }[];
export const searchIndex: SearchIndex = () => notImplemented("searchIndex", "P1", 14);
