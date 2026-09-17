import { CATEGORY_BY_ID } from "@/lib/config/categories";
import type { Photo } from "@/lib/types";
import { DATE_KIND_RU } from "./labels";

/**
 * Date from a source → Russian format. Full dates become DD.MM.YYYY, partial ones keep their precision
 * ("2019-06" → "06.2019", "2019" → "2019", Wikidata "2019-00-00" → "2019"). Anything else is shown as is:
 * `new Date()` would silently invent a day ("весна 2019" → 01.01.2019).
 */
export function formatDateRu(value: string): string {
  const iso = /^\+?(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?(?:$|[T ])/.exec(value.trim());
  if (!iso) return value;
  return [iso[3], iso[2], iso[1]].filter((part) => part && part !== "00").join(".");
}

/** «снято 12.06.2023». Without a source date, falls back to when the pipeline retrieved the photo. */
export function photoDateText(photo: Pick<Photo, "date" | "retrievedAt">): string {
  const date: NonNullable<Photo["date"]> = photo.date ?? { value: photo.retrievedAt, kind: "retrieved" };
  return `${DATE_KIND_RU[date.kind]} ${formatDateRu(date.value)}`;
}

/** Alt text: the source's own title when there is one, otherwise category and source domain. */
export function photoAlt(photo: Pick<Photo, "title" | "category" | "sourceDomain">): string {
  return photo.title?.trim() || `${CATEGORY_BY_ID[photo.category].labelRu}: фото с ${photo.sourceDomain}`;
}

/** Russian plural form: pluralRu(5, ["источник", "источника", "источников"]) → "источников". */
export function pluralRu(n: number, forms: readonly [one: string, few: string, many: string]): string {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
