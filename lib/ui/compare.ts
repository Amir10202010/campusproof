import { CATEGORIES, REQUIRED_AREAS, type CategoryConfig } from "@/lib/config/categories";
import type { CategoryCoverage, DegradedFlag, Photo, ProfileFact, UniversityProfile } from "@/lib/types";
import { sortForDisplay } from "./filters";

/** P4 · #38 · data preparation for /compare (saved profiles only — never runs the pipeline). */

export const COMPARE_PHOTOS_PER_AREA = 3;

const QID = /^Q\d{1,12}$/;

export function isQid(value: unknown): value is string {
  return typeof value === "string" && QID.test(value);
}

/** `?a=Q…&b=Q…` → the two selected universities; anything that isn't a QID is ignored. */
export function parseCompareParams(params: Record<string, string | string[] | undefined>): {
  a?: string;
  b?: string;
} {
  return { a: isQid(params.a) ? params.a : undefined, b: isQid(params.b) ? params.b : undefined };
}

export function compareHref(a?: string, b?: string): string {
  const search = new URLSearchParams();
  if (a) search.set("a", a);
  if (b) search.set("b", b);
  const query = search.toString();
  return query ? `/compare?${query}` : "/compare";
}

export interface CompareArea {
  category: CategoryConfig;
  /** Best photos shown by default (verified, then likely), at most COMPARE_PHOTOS_PER_AREA. */
  photos: Photo[];
  /** How many verified + likely photos the full profile has in this area. */
  shownTotal: number;
}

export interface CompareColumn {
  qid: string;
  name: string;
  place: string;
  website?: string;
  generatedAt: string;
  distanceToCityCenterM?: number;
  facts: ProfileFact[];
  coverage: { category: CategoryConfig; coverage: CategoryCoverage }[];
  areas: CompareArea[];
  totals: Record<Photo["tier"], number>;
  degraded: DegradedFlag[];
}

const EMPTY_COVERAGE: CategoryCoverage = { verified: 0, likely: 0, unconfirmed: 0, status: "none" };

export function toCompareColumn(profile: UniversityProfile, perArea = COMPARE_PHOTOS_PER_AREA): CompareColumn {
  const shown = profile.photos.filter((photo) => photo.tier !== "unconfirmed");
  const totals: Record<Photo["tier"], number> = { verified: 0, likely: 0, unconfirmed: 0 };
  for (const photo of profile.photos) totals[photo.tier] += 1;

  return {
    qid: profile.entity.qid,
    name: profile.entity.name,
    place: [profile.entity.city?.name, profile.entity.country].filter(Boolean).join(", "),
    website: profile.entity.website,
    generatedAt: profile.generatedAt,
    distanceToCityCenterM: profile.distanceToCityCenterM,
    facts: profile.facts,
    coverage: CATEGORIES.map((category) => ({
      category,
      coverage: profile.coverage[category.id] ?? EMPTY_COVERAGE,
    })),
    areas: REQUIRED_AREAS.map((category) => {
      const photos = sortForDisplay(shown.filter((photo) => photo.category === category.id));
      return { category, photos: photos.slice(0, perArea), shownTotal: photos.length };
    }),
    totals,
    degraded: profile.degraded,
  };
}

/** What a compare slot shows for GET /api/profile/{qid} (app/api/profile/[qid]/route.ts). */
export type SavedProfileResult =
  | { status: "ready"; profile: UniversityProfile }
  | { status: "not_cached" }
  | { status: "not_implemented" }
  | { status: "error" };

function looksLikeProfile(body: unknown): body is UniversityProfile {
  const profile = body as Partial<UniversityProfile> | null;
  return (
    typeof profile === "object" &&
    profile !== null &&
    isQid(profile.entity?.qid) &&
    Array.isArray(profile.photos) &&
    typeof profile.coverage === "object"
  );
}

export function savedProfileResult(httpStatus: number, body: unknown): SavedProfileResult {
  if (httpStatus === 200 && looksLikeProfile(body)) return { status: "ready", profile: body };
  if (httpStatus === 404) return { status: "not_cached" };
  if (httpStatus === 501) return { status: "not_implemented" };
  return { status: "error" };
}
