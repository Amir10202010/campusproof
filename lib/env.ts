/**
 * Typed access to environment variables. Server-only: never import this from a client component.
 * All variables are documented in .env.example. FREE services only (no paid APIs).
 */
export const env = {
  /** Google Gemini API, free tier (Google AI Studio key; the account holder must be 18+). */
  /** GEMINI_API_KEY may hold several keys separated by commas: the extra ones are spares for a
   * revoked or blocked key, NOT a way to stretch the free quota (see lib/vision/gemini.ts). */
  geminiApiKeys: (process.env.GEMINI_API_KEY ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean),
  geminiApiKey: (process.env.GEMINI_API_KEY ?? "").split(",")[0]?.trim() || undefined,
  /** Vision model id (spike S4, #22). The "-latest" aliases never 404 when Google retires a numbered model. */
  visionModel: process.env.VISION_MODEL ?? "gemini-flash-lite-latest",
  /** Text model for the campus description (#20). A different model keeps a separate free quota. */
  descriptionModel: process.env.DESCRIPTION_MODEL ?? "gemini-flash-latest",
  /** Used only when the main vision model is unavailable (503) or gone (404) — not to stretch a quota. */
  visionModelFallback: process.env.VISION_MODEL_FALLBACK ?? "gemini-flash-latest",

  /** Serper: 2,500 free queries, no card. Optional — without a key the web search source is skipped. */
  serperApiKey: process.env.SERPER_API_KEY,

  /**
   * Openverse (free CC-licensed photos). Optional — register an app for 10k requests/day (#33).
   * Openverse hands the credentials out as `client_id` / `client_secret`, and that is how they were
   * entered in Vercel, where a variable cannot be renamed without the value in hand. Both spellings are
   * accepted so the source runs on its real quota instead of the anonymous ~100 requests/day (#111);
   * the prefixed names win, and nothing else in this project uses an OAuth client id.
   * `||`, not `??`: .env.example ships these keys empty, and an empty value means "not set" here.
   */
  openverseClientId: process.env.OPENVERSE_CLIENT_ID || process.env.client_id,
  openverseClientSecret: process.env.OPENVERSE_CLIENT_SECRET || process.env.client_secret,

  /** Upstash Redis free tier. The Vercel Marketplace integration may name the vars KV_REST_API_*. */
  upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
  upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,

  wikimediaUserAgent:
    process.env.WIKIMEDIA_USER_AGENT ?? "CampusProof/0.1 (https://github.com/Amir10202010/campusproof)",

  pipelineVersion: process.env.PIPELINE_VERSION ?? "0.1.0",
  maxFreshProfilesPerDay: Number(process.env.MAX_FRESH_PROFILES_PER_DAY ?? 150),
  /** Judges at one venue often share a single IP, so this is a guard against abuse, not against a queue. */
  freshRunsPerClient: Number(process.env.FRESH_RUNS_PER_CLIENT ?? 40),
} as const;

export function configuredServices() {
  return {
    gemini: Boolean(env.geminiApiKey),
    serper: Boolean(env.serperApiKey),
    openverse: Boolean(env.openverseClientId && env.openverseClientSecret),
    redis: Boolean(env.upstashRedisUrl && env.upstashRedisToken),
  };
}
