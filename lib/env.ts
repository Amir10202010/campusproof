/**
 * Typed access to environment variables. Server-only: never import this from a client component.
 * All variables are documented in .env.example.
 */
export const env = {
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  /** Decided by spike S4 (docs/architecture.md §16). Candidates: claude-opus-5, claude-sonnet-5, claude-haiku-4-5. */
  visionModel: process.env.VISION_MODEL ?? "claude-opus-5",

  webSearchProvider: (process.env.WEB_SEARCH_PROVIDER ?? "serper") as "serper" | "brave",
  serperApiKey: process.env.SERPER_API_KEY,
  braveApiKey: process.env.BRAVE_API_KEY,

  upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL,
  upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN,

  wikimediaUserAgent:
    process.env.WIKIMEDIA_USER_AGENT ??
    "CampusProof/0.1 (https://github.com/Amir10202010/campusproof)",

  pipelineVersion: process.env.PIPELINE_VERSION ?? "0.1.0",
  maxFreshProfilesPerDay: Number(process.env.MAX_FRESH_PROFILES_PER_DAY ?? 400),
} as const;

export function configuredServices() {
  return {
    anthropic: Boolean(env.anthropicApiKey),
    serper: Boolean(env.serperApiKey),
    brave: Boolean(env.braveApiKey),
    redis: Boolean(env.upstashRedisUrl && env.upstashRedisToken),
  };
}
