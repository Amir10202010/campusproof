import { notImplemented } from "@/lib/notImplemented";
import type { Candidate, RunContext, UniversityEntity } from "@/lib/types";

export interface CommonsGatherResult {
  candidates: Candidate[];
  /** Subcategory names (e.g. "Library of …") — passed to the vision model as context. */
  subcategories: string[];
}

/**
 * P1 · issue #9 · docs/architecture.md §5.2 (Commons adapter)
 * Category tree (≤4 subcategories), depicts search (haswbstatement:P180=QID), geosearch 1000 m,
 * city category; batched imageinfo + extmetadata (strip HTML). ≤8 Wikimedia calls. Respect ctx.signal.
 */
export type GatherCommons = (entity: UniversityEntity, ctx: RunContext) => Promise<CommonsGatherResult>;
export const gatherCommons: GatherCommons = async () => notImplemented("gatherCommons", "P1", 9);
