import { notImplemented } from "@/lib/notImplemented";
import type { VisionObservation } from "@/lib/types";

/**
 * P2 · issue #18 · zod schema mirroring VISION_OUTPUT_JSON_SCHEMA; maps "" → null for
 * watermark_text, other_institution_name, near_duplicate_of. Throws on invalid output (caller retries).
 */
export type ParseVisionObservations = (raw: unknown) => VisionObservation[];
export const parseVisionObservations: ParseVisionObservations = () =>
  notImplemented("parseVisionObservations", "P2", 18);
