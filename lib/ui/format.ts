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

/** 80 → «80 м», 1240 → «1,2 км», 11200 → «11 км». */
export function formatDistanceRu(meters: number): string {
  if (meters < 100) return `${Math.round(meters)} м`;
  if (meters < 1000) return `${Math.round(meters / 10) * 10} м`;
  const km = meters / 1000;
  return `${km < 10 ? km.toLocaleString("ru-RU", { maximumFractionDigits: 1 }) : Math.round(km).toLocaleString("ru-RU")} км`;
}

/** 16420 → «16,4 с». */
export function formatSecondsRu(ms: number): string {
  return `${(ms / 1000).toLocaleString("ru-RU", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} с`;
}

/** ISO timestamp → «17.09.2026, 14:02» in the viewer's time zone. */
export function formatDateTimeRu(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Links from sources are untrusted: only http(s) URLs become links (never javascript: or data:). */
export function safeHttpUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/** «https://www.example.edu/about» → «example.edu». */
export function displayHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** Russian plural form: pluralRu(5, ["источник", "источника", "источников"]) → "источников". */
export function pluralRu(n: number, forms: readonly [one: string, few: string, many: string]): string {
  const mod10 = Math.abs(n) % 10;
  const mod100 = Math.abs(n) % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}
