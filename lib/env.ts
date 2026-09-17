/**
 * Typed access to environment variables. Server-only: never import this from a client component.
 * All variables are documented in .env.example. FREE services only (no paid APIs).
 */
export const env = {
  /** Google Gemini API, free tier (Google AI Studio key; the account holder must be 18+). */
  geminiApiKey: process.env.GEMINI_API_KEY,
  /** Vision model id — decided by spike S4 (issue #22). Must be a model with a free tier. */
  visionModel: process.env.VISION_MODEL ?? "gemini-2.5-flash-lite",
  /** Text model for the campus description (#20). A different model keeps a separate free quota. */
  descriptionModel: process.env.DESCRIPTION_MODEL ?? "gemini-2.5-flash",

  /** Serper: 2,500 free queries, no card. Optional — without a key the web search source is skipped. */
  serperApiKey: process.env.SERPER_API_KEY,

  /** Openverse (free CC-licensed photos). Optional — register an app for 10k requests/day (#33). */
  openverseClientId: process.env.OPENVERSE_CLIENT_ID,
  openverseClientSecret: process.env.OPENVERSE_CLIENT_SECRET,

  /** Upstash Redis free tier. The Vercel Marketplace integration may name the vars KV_REST_API_*. */
  upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL,
  upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN,

  wikimediaUserAgent:
    process.env.WIKIMEDIA_USER_AGENT ?? "CampusProof/0.1 (https://github.com/Amir10202010/campusproof)",

  pipelineVersion: process.env.PIPELINE_VERSION ?? "0.1.0",
  maxFreshProfilesPerDay: Number(process.env.MAX_FRESH_PROFILES_PER_DAY ?? 150),
} as const;

export function configuredServices() {
  return {
    gemini: Boolean(env.geminiApiKey),
    serper: Boolean(env.serperApiKey),
    openverse: Boolean(env.openverseClientId && env.openverseClientSecret),
    redis: Boolean(env.upstashRedisUrl && env.upstashRedisToken),
  };
}
