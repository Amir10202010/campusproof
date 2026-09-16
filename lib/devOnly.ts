/**
 * Dev-only features (fixture pages, replay stream) must never be reachable in production:
 * fixture data is not real pipeline output. Vercel sets VERCEL_ENV to "production" | "preview" | "development".
 */
export const devFeaturesEnabled = process.env.VERCEL_ENV !== "production";
