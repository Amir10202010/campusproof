import type { CategoryId, Photo, SourceType } from "@/lib/types";

/** Filter state of the profile page. Empty arrays mean "all". Owner: P4. */
export interface ProfileFilters {
  categories: CategoryId[];
  sourceTypes: SourceType[];
  showUnconfirmed: boolean;
}

export const DEFAULT_FILTERS: ProfileFilters = { categories: [], sourceTypes: [], showUnconfirmed: false };

export function applyFilters(photos: Photo[], filters: ProfileFilters): Photo[] {
  return photos.filter(
    (photo) =>
      (filters.showUnconfirmed || photo.tier !== "unconfirmed") &&
      (filters.categories.length === 0 || filters.categories.includes(photo.category)) &&
      (filters.sourceTypes.length === 0 || filters.sourceTypes.includes(photo.sourceType)),
  );
}

/**
 * «Официальные vs независимые» lens (product-strategy §4.9) over `sourceTypes`. Independent = everything not
 * published by the university itself; `unknown` belongs to neither side, so it is visible only under «Все».
 */
export const SOURCE_LENSES = [
  { id: "all", label: "Все источники", sourceTypes: [] },
  { id: "official", label: "Официальные", sourceTypes: ["official"] },
  { id: "independent", label: "Независимые", sourceTypes: ["encyclopedic", "news", "independent", "social"] },
] as const satisfies readonly { id: string; label: string; sourceTypes: readonly SourceType[] }[];

export type SourceLensId = (typeof SOURCE_LENSES)[number]["id"];

/** Which lens the current `sourceTypes` match; anything custom counts as "all". */
export function lensOf(filters: ProfileFilters): SourceLensId {
  const selected = [...filters.sourceTypes].sort().join(",");
  return SOURCE_LENSES.find((lens) => [...lens.sourceTypes].sort().join(",") === selected)?.id ?? "all";
}

export function withLens(filters: ProfileFilters, id: SourceLensId): ProfileFilters {
  const lens = SOURCE_LENSES.find((l) => l.id === id) ?? SOURCE_LENSES[0];
  return { ...filters, sourceTypes: [...lens.sourceTypes] };
}

const TIER_RANK: Record<Photo["tier"], number> = { verified: 0, likely: 1, unconfirmed: 2 };

/** Display order inside a category: tier, then evidence points. Stable, so ties keep the pipeline's order. */
export function sortForDisplay(photos: Photo[]): Photo[] {
  return [...photos].sort((a, b) => TIER_RANK[a.tier] - TIER_RANK[b.tier] || b.points - a.points);
}

export function toggleCategory(filters: ProfileFilters, id: CategoryId): ProfileFilters {
  const categories = filters.categories.includes(id)
    ? filters.categories.filter((c) => c !== id)
    : [...filters.categories, id];
  return { ...filters, categories };
}
