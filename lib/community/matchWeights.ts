import type { CategoryCoverage, CategoryId } from "@/lib/types";

/**
 * Deterministic weights for /api/match (owner: P1 · community feature, Этап 3). NO model is involved in
 * ranking — every point here is readable and arguable. Region and "confirmed photos in categories the
 * applicant cares about" are the only criteria we can score honestly: the index (data/universities.min.json,
 * built by P3 #24) has no field of study, tuition/grant or language-of-instruction data, so those inputs
 * from the onboarding brief are intentionally NOT scored here rather than faked — see docs/architecture.md's
 * "honest not found beats a guess" rule.
 */
export const MATCH_WEIGHTS = {
  COUNTRY_MATCH: 40,
  CITY_MATCH: 20,
  /** Small nudge from Wikidata sitelinks (a popularity signal, not a quality judgement); capped. */
  POPULARITY_MAX: 8,
  POPULARITY_SITELINKS_CAP: 80,
  /** Per requested category: "good" coverage (>=3 verified+likely photos) vs. just "thin" (1-2). */
  CATEGORY_COVERAGE_GOOD: 15,
  CATEGORY_COVERAGE_THIN: 6,
} as const;

export interface MatchCriteria {
  countryCode?: string;
  cityName?: string;
  importantCategories: CategoryId[];
}

export interface MatchReasonInput {
  countryCode: string;
  country: string;
  cityName?: string;
  sitelinks: number;
  coverage: Partial<Record<CategoryId, CategoryCoverage>> | null;
}

export interface MatchScoreResult {
  score: number;
  reasons: string[];
}

/** Pure, testable scoring — no I/O. The route looks up coverage; this function only turns it into a score. */
export function scoreCandidate(criteria: MatchCriteria, input: MatchReasonInput): MatchScoreResult {
  let score = 0;
  const reasons: string[] = [];

  if (criteria.countryCode && input.countryCode === criteria.countryCode) {
    score += MATCH_WEIGHTS.COUNTRY_MATCH;
    reasons.push(`находится в стране «${input.country}»`);
  }
  if (criteria.cityName && input.cityName && normalize(input.cityName) === normalize(criteria.cityName)) {
    score += MATCH_WEIGHTS.CITY_MATCH;
    reasons.push(`город совпадает: ${input.cityName}`);
  }

  const popularity = Math.min(input.sitelinks, MATCH_WEIGHTS.POPULARITY_SITELINKS_CAP);
  score += (popularity / MATCH_WEIGHTS.POPULARITY_SITELINKS_CAP) * MATCH_WEIGHTS.POPULARITY_MAX;

  const confirmedIn: string[] = [];
  for (const category of criteria.importantCategories) {
    const status = input.coverage?.[category]?.status;
    if (status === "good") {
      score += MATCH_WEIGHTS.CATEGORY_COVERAGE_GOOD;
      confirmedIn.push(category);
    } else if (status === "thin") {
      score += MATCH_WEIGHTS.CATEGORY_COVERAGE_THIN;
      confirmedIn.push(category);
    }
  }
  if (confirmedIn.length > 0) {
    reasons.push(`есть подтверждённые фото в разделах: ${confirmedIn.join(", ")}`);
  } else if (criteria.importantCategories.length > 0) {
    reasons.push("подтверждённых фото по выбранным разделам пока нет — честно, без подгонки");
  }

  return { score: Math.round(score * 10) / 10, reasons };
}

function normalize(text: string): string {
  return text.trim().toLowerCase();
}
