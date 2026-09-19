import type { NextRequest } from "next/server";
import universities from "@/data/universities.min.json";
import { getCachedProfile } from "@/lib/cache/profileCache";
import { scoreCandidate, type MatchCriteria } from "@/lib/community/matchWeights";
import type { CategoryId, UniversityIndexEntry } from "@/lib/types";

/**
 * POST /api/match — deterministic ranking over data/universities.min.json + cached profiles.
 * NO model decides the order (see lib/community/matchWeights.ts). Owner: P1 · community feature, Этап 3.
 */
export const runtime = "nodejs";

const CANDIDATE_POOL = 40;
const DEFAULT_LIMIT = 10;
const KNOWN_CATEGORIES = new Set<CategoryId>([
  "dormitory",
  "sports",
  "lab",
  "student_life",
  "campus",
  "classroom",
  "library",
  "city",
]);

export async function POST(request: NextRequest) {
  let body: { countryCode?: string; cityName?: string; categories?: string[]; limit?: number };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const criteria: MatchCriteria = {
    countryCode: body.countryCode?.trim().toUpperCase() || undefined,
    cityName: body.cityName?.trim() || undefined,
    importantCategories: (body.categories ?? []).filter((c): c is CategoryId => KNOWN_CATEGORIES.has(c as CategoryId)),
  };
  const limit =
    Number.isInteger(body.limit) && (body.limit as number) > 0 ? Math.min(body.limit as number, 30) : DEFAULT_LIMIT;

  const entries = universities as UniversityIndexEntry[];
  const pool = (criteria.countryCode ? entries.filter((e) => e.countryCode === criteria.countryCode) : entries)
    .slice()
    .sort((a, b) => b.sitelinks - a.sitelinks)
    .slice(0, CANDIDATE_POOL);

  const coverages = await Promise.all(pool.map((entry) => getCachedProfile(entry.qid)));

  const ranked = pool
    .map((entry, i) => {
      const profile = coverages[i];
      const { score, reasons } = scoreCandidate(criteria, {
        countryCode: entry.countryCode,
        country: entry.country,
        cityName: entry.city?.name,
        sitelinks: entry.sitelinks,
        coverage: profile?.coverage ?? null,
      });
      return {
        qid: entry.qid,
        name: entry.names.ru ?? entry.names.en ?? entry.qid,
        city: entry.city?.name,
        country: entry.country,
        score,
        reasons,
        hasProfileData: Boolean(profile),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  return Response.json({ results: ranked, poolSize: pool.length });
}
