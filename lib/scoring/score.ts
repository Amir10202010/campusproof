import { CATEGORIES } from "@/lib/config/categories";
import type { CategoryId, FetchedCandidate, ScoreResult, ScoringContext, VisionObservation } from "@/lib/types";
import { collectSignals } from "./signals";
import { decideTier } from "./tiers";

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

const CATEGORY_IDS = new Set<string>(CATEGORIES.map((category) => category.id));

const isCategory = (value: string): value is CategoryId => CATEGORY_IDS.has(value);

/** What the photo shows: the model's category, else the hint from the source, else the generic campus section. */
export function resolveCategory(
  candidate: FetchedCandidate,
  observation: VisionObservation | null,
): { category: CategoryId; secondary: CategoryId[] } {
  const primary =
    observation && isCategory(observation.primary_category)
      ? observation.primary_category
      : (candidate.categoryHint ?? "campus");
  const secondary = (observation?.secondary_categories ?? []).filter(
    (id, index, all): id is CategoryId => isCategory(id) && id !== primary && all.indexOf(id) === index,
  );
  return { category: primary, secondary };
}

export const scoreCandidate: ScoreCandidate = (candidate, observation, context) => {
  const { category, secondary } = resolveCategory(candidate, observation);
  const signals = collectSignals(candidate, observation, context, category);
  const points = signals.evidence.reduce((sum, item) => sum + item.points, 0);
  const base = { points, category, secondary, evidence: signals.evidence, labels: signals.labels };

  if (signals.reject) return { ...base, tier: "rejected", reject: signals.reject };

  const tier = decideTier({
    points,
    strong: signals.strong,
    negativeVisual: signals.negativeVisual,
    // #118 · the stage can report "ok" and still leave images unchecked (the free quota dies between
    // batches). Tier follows this image, not the stage: signals.ts already labels it
    // "visual_check_unavailable", so promoting it to "likely" would contradict its own label.
    visionAvailable: context.visionAvailable && observation !== null,
  });

  if (tier === "rejected") {
    return {
      ...base,
      tier,
      reject: { reason: "low_score", detail: `Слишком мало доказательств: ${points} из 60 очков` },
    };
  }
  return { ...base, tier };
};
