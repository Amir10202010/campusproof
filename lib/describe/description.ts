import { notImplemented } from "@/lib/notImplemented";
import type { Description, ProfileFact, UniversityEntity, WikipediaSummary } from "@/lib/types";

export interface DescribeInput {
  entity: UniversityEntity;
  summaries: WikipediaSummary[];
  facts: ProfileFact[];
  /** false → never call Gemini (visitor region, see lib/pipeline/regions.ts): use the Wikipedia fallback. */
  aiAllowed: boolean;
}

/**
 * P1 · issue #20 · FREE: Gemini (`env.descriptionModel`, SDK `@google/genai`) gets the numbered sources
 * (Wikipedia extracts + Wikidata facts) and returns JSON `{ sentences: [{ text, sources: [n, …] }] }`.
 * Code validates that every sentence cites existing sources, builds `text` with [n] markers + `citations`.
 * 3–5 RU sentences for applicants, only from the sources. No sources → null.
 * !aiAllowed / no key / model error / quota → fallback: quote 2–3 sentences of the ru (else en) Wikipedia extract as [1].
 */
export type DescribeCampus = (input: DescribeInput, signal: AbortSignal) => Promise<Description | null>;
export const describeCampus: DescribeCampus = async () => notImplemented("describeCampus", "P1", 20);
