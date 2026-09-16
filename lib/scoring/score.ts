import { notImplemented } from "@/lib/notImplemented";
import type { FetchedCandidate, ScoreResult, ScoringContext, VisionObservation } from "@/lib/types";

/**
 * P2 · issue #17 (v0: non-visual signals) → issue #19 (v1: visual signals, hard rejects).
 * The ONLY place that decides points and tiers (docs/architecture.md §5.6). Pure function, unit-tested.
 * `observation` is null when vision is unavailable/simulated down → web-only candidates cap at "unconfirmed".
 */
export type ScoreCandidate = (
  candidate: FetchedCandidate,
  observation: VisionObservation | null,
  context: ScoringContext,
) => ScoreResult;
export const scoreCandidate: ScoreCandidate = () => notImplemented("scoreCandidate", "P2", 17);
