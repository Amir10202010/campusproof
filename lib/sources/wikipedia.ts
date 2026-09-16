import { notImplemented } from "@/lib/notImplemented";
import type { UniversityEntity, WikipediaSummary } from "@/lib/types";

/** P1 · issue #8 · page summaries (ru first, then en) for the entity's Wikipedia articles, via wikimediaFetch. */
export type GetSummaries = (entity: UniversityEntity, signal: AbortSignal) => Promise<WikipediaSummary[]>;
export const getSummaries: GetSummaries = async () => notImplemented("getSummaries", "P1", 8);
