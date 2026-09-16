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

export function toggleCategory(filters: ProfileFilters, id: CategoryId): ProfileFilters {
  const categories = filters.categories.includes(id)
    ? filters.categories.filter((c) => c !== id)
    : [...filters.categories, id];
  return { ...filters, categories };
}
