import { TIER_THRESHOLDS } from "@/lib/config/limits";
import type { Tier } from "@/lib/types";

export interface TierInput {
  points: number;
  /** At least one strong signal (docs/architecture.md §5.6): depicts, Commons category, geo near campus, Wikipedia, official domain, name visible on the photo. */
  strong: boolean;
  /** Render or a scene that contradicts the context. */
  negativeVisual: boolean;
  /** false → the vision model did not look at this image (unavailable or simulated down). */
  visionAvailable: boolean;
}

/**
 * P2 · issue #17 · the tier table of docs/architecture.md §5.6. Points come from recorded evidence only —
 * this function never looks at the image and never asks a model.
 */
export function decideTier({ points, strong, negativeVisual, visionAvailable }: TierInput): Tier {
  if (points >= TIER_THRESHOLDS.verified && strong && !negativeVisual) return "verified";
  // Degraded mode: provenance can still carry a photo, but an image known only from web search stays unconfirmed.
  if (points >= TIER_THRESHOLDS.likely) return visionAvailable || strong ? "likely" : "unconfirmed";
  if (points >= TIER_THRESHOLDS.unconfirmed) return "unconfirmed";
  return "rejected";
}
