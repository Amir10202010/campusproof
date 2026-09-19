import { GoogleGenAI } from "@google/genai";
import type { NextRequest } from "next/server";
import { getRedis } from "@/lib/cache/kv";
import { allowDeepHealthProbe, DEEP_PROBES_PER_WINDOW } from "@/lib/cache/ratelimit";
import { configuredServices, env } from "@/lib/env";
import { visionFailureReason } from "@/lib/pipeline/reasons";
import { wikimediaApiUrl, wikimediaFetch } from "@/lib/sources/wikimediaFetch";

export const dynamic = "force-dynamic";

const PROBE_TIMEOUT_MS = 3_000;

/**
 * Health check used before every demo and during 19–25 Sep monitoring.
 * `?deep=1` — reachability probes: Wikidata, Redis and one tiny Gemini call (a few tokens) that turns a broken key
 * into a readable answer. `&search=1` adds one Serper request (costs one of the 2,500 free credits).
 * Never return secret values here — statuses, timings and format checks only.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const deepRequested = params.get("deep") === "1";
  // Deep probes spend free quotas, so they share a small global window (lib/cache/ratelimit.ts).
  const deep = deepRequested && (await allowDeepHealthProbe());
  const probes = deep ? await runProbes(params.get("search") === "1") : undefined;
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
    ...(deepRequested && !deep
      ? { deep: `пропущено: не больше ${DEEP_PROBES_PER_WINDOW} глубоких проверок за 10 минут на всех` }
      : {}),
  });
}

interface Probe {
  status: "up" | "down" | "not_configured";
  ms?: number;
  /** Short Russian reason when a probe is down — the same wording the pipeline shows. */
  reason?: string;
  /** Format checks of the configured key: never the key itself. */
  key?: { length: number; looksLikeApiKey: boolean; hasWhitespace: boolean };
}

async function runProbes(withSearch: boolean): Promise<Record<string, Probe>> {
  const [wikidata, redis, gemini, serper] = await Promise.all([
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
    geminiProbe(),
    withSearch ? serperProbe() : Promise.resolve<Probe>({ status: "not_configured" }),
  ]);
  return { wikidata, redis, gemini, serper };
}

/** One "ping" generation on the vision model: proves the key works from this region, costs a few tokens. */
async function geminiProbe(): Promise<Probe> {
  const apiKey = env.geminiApiKey;
  if (!apiKey) return { status: "not_configured" };
  const key = {
    length: apiKey.length,
    // Google AI Studio keys look like AIza… — an OAuth token or a service-account JSON is rejected with 401.
    looksLikeApiKey: /^AIza[\w-]{30,}$/.test(apiKey),
    hasWhitespace: apiKey.trim() !== apiKey || /\s/.test(apiKey),
  };
  const started = Date.now();
  try {
    await new GoogleGenAI({ apiKey }).models.generateContent({
      model: env.visionModel,
      contents: "ping",
      config: { maxOutputTokens: 1, abortSignal: AbortSignal.timeout(PROBE_TIMEOUT_MS * 3) },
    });
    return { status: "up", ms: Date.now() - started, key };
  } catch (error) {
    return { status: "down", ms: Date.now() - started, reason: visionFailureReason(error), key };
  }
}

/** One real Serper request (1 credit of 2,500) — only with `&search=1`; reports the API's own answer. */
async function serperProbe(): Promise<Probe> {
  if (!env.serperApiKey) return { status: "not_configured" };
  const started = Date.now();
  try {
    const response = await fetch("https://google.serper.dev/images", {
      method: "POST",
      headers: { "X-API-KEY": env.serperApiKey, "content-type": "application/json" },
      body: JSON.stringify({ q: "Nazarbayev University campus" }),
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS * 2),
    });
    const body = await response.text();
    if (!response.ok) {
      return { status: "down", ms: Date.now() - started, reason: `HTTP ${response.status}: ${body.slice(0, 160)}` };
    }
    const images = (JSON.parse(body) as { images?: unknown[] }).images?.length ?? 0;
    return { status: "up", ms: Date.now() - started, reason: `картинок в ответе: ${images}` };
  } catch (error) {
    return { status: "down", ms: Date.now() - started, reason: error instanceof Error ? error.message : String(error) };
  }
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
