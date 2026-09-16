import { notImplemented } from "@/lib/notImplemented";
import type { Description, ProfileFact, UniversityEntity, WikipediaSummary } from "@/lib/types";

export interface DescribeInput {
  entity: UniversityEntity;
  summaries: WikipediaSummary[];
  facts: ProfileFact[];
}

/**
 * P1 · issue #20 · Claude with the sources as document blocks (citations enabled) → 3–5 RU sentences
 * with [n] markers ↔ citations. No sources → null. Model error → fallback: quote 2–3 sentences of the
 * Wikipedia extract with its link.
 */
export type DescribeCampus = (input: DescribeInput, signal: AbortSignal) => Promise<Description | null>;
export const describeCampus: DescribeCampus = async () => notImplemented("describeCampus", "P1", 20);
