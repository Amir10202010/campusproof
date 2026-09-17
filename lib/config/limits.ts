/**
 * Budgets, timeouts and thresholds (docs/architecture.md §5.0, §5.6, §8).
 * Starting values — tune them on the labeled set, don't sprinkle magic numbers elsewhere.
 */
export const LIMITS = {
  GLOBAL_DEADLINE_MS: 27_000,
  RESOLVE_TIMEOUT_MS: 2_500,
  ADAPTER_TIMEOUT_MS: 7_000,

  IMAGE_FETCH_TIMEOUT_MS: 3_000,
  IMAGE_FETCH_MAX_BYTES: 5 * 1024 * 1024,
  IMAGE_FETCH_MAX_REDIRECTS: 3,
  IMAGE_FETCH_CONCURRENCY: 16,
  IMAGE_MIN_SHORT_SIDE_PX: 300,

  // Free Gemini tier: few requests per minute/day → ≤3 vision requests per profile (36 images / 12 per request).
  VISION_IMAGE_LONG_EDGE_PX: 640,
  VISION_MAX_IMAGES: 36,
  VISION_BATCH_SIZE: 12,
  VISION_MAX_PARALLEL_BATCHES: 3,
  VISION_BATCH_TIMEOUT_MS: 15_000,
  VISION_CACHE_TTL_S: 14 * 24 * 3600,
  // One free Gemini text call per fresh profile (#20); on timeout the Wikipedia quote is used instead.
  DESCRIPTION_TIMEOUT_MS: 12_000,

  // Serper has 2,500 free credits in total → few queries per profile + cached responses.
  WEB_SEARCH_MAX_QUERIES: 6,
  OPENVERSE_MAX_QUERIES: 2,
  WIKIMEDIA_MAX_CALLS_PER_PROFILE: 15,

  DHASH_NEAR_DUPLICATE_MAX_HAMMING: 6,
  PHOTOS_PER_CATEGORY_DISPLAY: 12,

  PROFILE_CACHE_TTL_S: 14 * 24 * 3600,
  RESOLVE_CACHE_TTL_S: 7 * 24 * 3600,
  WIKIMEDIA_CACHE_TTL_S: 24 * 3600,
  SEARCH_CACHE_TTL_S: 72 * 3600,

  QUERY_MAX_LENGTH: 120,
} as const;

/** Evidence-point thresholds for tiers (docs/architecture.md §5.6). */
export const TIER_THRESHOLDS = {
  verified: 60,
  likely: 35,
  unconfirmed: 10,
} as const;

/** Geo rules in meters. */
export const GEO = {
  STRONG_NEAR_CAMPUS_M: 1_500,
  SAME_CITY_M: 30_000,
  FAR_AWAY_M: 50_000,
} as const;
