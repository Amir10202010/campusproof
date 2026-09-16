import { CATEGORIES } from "@/lib/config/categories";
import type { CategoryCoverage, CategoryId, Photo } from "@/lib/types";

/** Counts photos per category and tier; status: good (≥3 verified+likely), thin (1–2), none (0). */
export function computeCoverage(photos: Photo[]): Record<CategoryId, CategoryCoverage> {
  const coverage = Object.fromEntries(
    CATEGORIES.map((c) => [c.id, { verified: 0, likely: 0, unconfirmed: 0, status: "none" }]),
  ) as Record<CategoryId, CategoryCoverage>;

  for (const photo of photos) coverage[photo.category][photo.tier] += 1;

  for (const entry of Object.values(coverage)) {
    const shown = entry.verified + entry.likely;
    entry.status = shown >= 3 ? "good" : shown >= 1 ? "thin" : "none";
  }
  return coverage;
}
