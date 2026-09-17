import type { NextRequest } from "next/server";
import { getRedis } from "@/lib/cache/kv";
import { configuredServices, env } from "@/lib/env";
import { wikimediaApiUrl, wikimediaFetch } from "@/lib/sources/wikimediaFetch";

export const dynamic = "force-dynamic";

const PROBE_TIMEOUT_MS = 3_000;

/**
 * Health check used before every demo and during 19–25 Sep monitoring.
 * `?deep=1` adds cheap reachability probes (Wikidata, Redis) with latency — no AI or search calls, so no free quota
 * is spent. Never return secret values here — booleans, statuses and timings only.
 */
export async function GET(request: NextRequest) {
  const deep = request.nextUrl.searchParams.get("deep") === "1";
  const probes = deep ? await runProbes() : undefined;
  return Response.json({
    ok: probes ? Object.values(probes).every((p) => p.status !== "down") : true,
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
    descriptionModel: env.descriptionModel,
    ...(probes ? { probes } : {}),
  });
}

interface Probe {
  status: "up" | "down" | "not_configured";
  ms?: number;
}

async function runProbes(): Promise<Record<string, Probe>> {
  const [wikidata, redis] = await Promise.all([
    probe(async (signal) => {
      // Straight through wikimediaFetch (no Redis cache): the probe must really reach Wikimedia.
      const url = wikimediaApiUrl("www.wikidata.org", { action: "query", meta: "siteinfo", siprop: "general" });
      const response = await wikimediaFetch(url, { signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
    }),
    getRedis()
      ? probe(async () => {
          await getRedis()?.ping();
        })
      : Promise.resolve<Probe>({ status: "not_configured" }),
  ]);
  return { wikidata, redis };
}

async function probe(task: (signal: AbortSignal) => Promise<void>): Promise<Probe> {
  const started = Date.now();
  try {
    await task(AbortSignal.timeout(PROBE_TIMEOUT_MS));
    return { status: "up", ms: Date.now() - started };
  } catch {
    return { status: "down", ms: Date.now() - started };
  }
}
