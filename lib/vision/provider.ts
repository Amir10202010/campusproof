import type { UniversityEntity, VisionObservation } from "@/lib/types";

export interface VisionItem {
  id: string; // FetchedCandidate.id
  jpeg: Buffer; // PreparedImage.jpeg
  meta: string; // one line: source domain | page title | caption | category hint
}

export interface VisionContext {
  entity: UniversityEntity;
  subcategories: string[]; // Commons subcategory names
  wikipediaExtract?: string; // ≤600 chars
}

/** P2 · issue #18 · one implementation per model provider (claude.ts). Returns one observation per item. */
export interface VisionProvider {
  observe(items: VisionItem[], context: VisionContext, signal: AbortSignal): Promise<VisionObservation[]>;
}
