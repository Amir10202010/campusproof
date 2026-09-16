import { notImplemented } from "@/lib/notImplemented";
import type { RunContext, VisionObservation } from "@/lib/types";
import type { VisionContext, VisionItem, VisionProvider } from "./provider";

/**
 * P2 · issue #18 · batches of LIMITS.VISION_BATCH_SIZE (grouped by category hint), 5 in parallel,
 * best candidates first, LIMITS.VISION_BATCH_TIMEOUT_MS per batch; on failure retry once with half
 * the batch; call onBatch as soon as each batch returns (the orchestrator streams photos from it).
 */
export type ObserveAll = (
  items: VisionItem[],
  context: VisionContext,
  provider: VisionProvider,
  ctx: RunContext,
  onBatch?: (observations: VisionObservation[]) => void,
) => Promise<Map<string, VisionObservation>>;
export const observeAll: ObserveAll = async () => notImplemented("observeAll", "P2", 18);
