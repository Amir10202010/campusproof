import { configuredServices, env } from "@/lib/env";

export const dynamic = "force-dynamic";

/**
 * Health check used before every demo and during 19–25 Sep monitoring.
 * P1 extends this with cheap reachability checks per provider (docs/architecture.md §4).
 * Never return secret values here — booleans only.
 */
export async function GET() {
  return Response.json({
    ok: true,
    service: "campusproof",
    pipelineVersion: env.pipelineVersion,
    time: new Date().toISOString(),
    vercel: {
      env: process.env.VERCEL_ENV ?? "local",
      region: process.env.VERCEL_REGION ?? null,
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
    },
    node: process.version,
    configured: configuredServices(),
    visionModel: env.visionModel,
    webSearchProvider: env.webSearchProvider,
  });
}
