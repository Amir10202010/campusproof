import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sampleProfile } from "@/fixtures/profile.sample";
import recorded from "@/tests/data/wikidata-resolver.json";
import { replayFetch } from "@/tests/helpers/replayFetch";
import { getCachedProfile, profileCacheKey, saveProfile } from "@/lib/cache/profileCache";
import { NotImplementedError } from "@/lib/notImplemented";
import type { PipelineDeps } from "@/lib/pipeline/deps";
import { runProfilePipeline } from "@/lib/pipeline/orchestrator";
import { resolveCacheKey, resolveQuery } from "@/lib/resolver/resolve";
import { clearWikidataMemo } from "@/lib/sources/wikidata";
import { wikimediaApi } from "@/lib/sources/wikimediaFetch";
import type { StreamEvent } from "@/lib/types";

/** In-memory stand-in for Upstash (lib/cache/kv.ts): tests never talk to Redis. */
const store = vi.hoisted(() => new Map<string, { value: unknown; ttl: number }>());
vi.mock("@/lib/cache/kv", () => ({
  getRedis: () => null,
  kvGet: async (key: string) => structuredClone(store.get(key)?.value ?? null),
  kvSet: async (key: string, value: unknown, ttl: number) =>
    void store.set(key, { value: structuredClone(value), ttl }),
}));

let calls: ReturnType<typeof replayFetch>;
beforeEach(() => {
  store.clear();
  clearWikidataMemo();
  calls = replayFetch(recorded as Record<string, unknown>);
});
afterEach(() => vi.unstubAllGlobals());

const signal = () => new AbortController().signal;

describe("profile cache", () => {
  it("stores healthy profiles for 14 days under a versioned key and reads them back", async () => {
    await saveProfile(sampleProfile);
    const entry = store.get(profileCacheKey(sampleProfile.entity.qid));
    expect(profileCacheKey("Q1")).toMatch(/^profile:[^:]+:Q1$/);
    expect(entry?.ttl).toBe(14 * 24 * 3600);
    expect(await getCachedProfile(sampleProfile.entity.qid)).toEqual(sampleProfile);
  });

  it("never stores degraded profiles and misses unknown ids", async () => {
    await saveProfile({ ...sampleProfile, degraded: ["vision_unavailable"] });
    expect(store.size).toBe(0);
    expect(await getCachedProfile("Q404")).toBeNull();
  });
});

describe("resolver and Wikimedia caches", () => {
  it("answers a repeated query from the resolve cache without Wikimedia calls", async () => {
    const first = await resolveQuery("KBTU", signal());
    const liveCalls = calls.length;
    expect(store.get(resolveCacheKey("kbtu"))?.ttl).toBe(7 * 24 * 3600);

    clearWikidataMemo();
    const second = await resolveQuery("  kbtu ", signal());
    expect(second).toEqual(first);
    expect(calls.length).toBe(liveCalls);
  });

  it("caches not_found only for a day", async () => {
    await resolveQuery("asdfgh", signal());
    expect(store.get(resolveCacheKey("asdfgh"))?.ttl).toBe(24 * 3600);
  });

  it("serves identical Action API requests from the 24 h cache", async () => {
    const params = { action: "wbgetclaims", entity: "Q232", property: "P297" };
    vi.stubGlobal("fetch", async () => Response.json({ claims: {} }));
    await wikimediaApi("www.wikidata.org", params, signal());
    const fetchSpy = vi.fn(async () => Response.json({ claims: {} }));
    vi.stubGlobal("fetch", fetchSpy);
    await wikimediaApi("www.wikidata.org", params, signal());
    expect(fetchSpy).not.toHaveBeenCalled();
    expect([...store.values()][0].ttl).toBe(24 * 3600);
  });
});

describe("orchestrator with a saved profile", () => {
  const missing = (what: string): never => {
    throw new NotImplementedError(what, "PX", 0);
  };
  const deps = (overrides: Partial<PipelineDeps>): PipelineDeps => ({
    resolveQuery: async () => missing("resolveQuery"),
    getEntity: vi.fn(async () => missing("getEntity")),
    getSummaries: async () => missing("getSummaries"),
    gatherCommons: async () => missing("gatherCommons"),
    gatherWebSearch: async () => missing("gatherWebSearch"),
    gatherOpenverse: async () => missing("gatherOpenverse"),
    fetchCandidates: async () => missing("fetchCandidates"),
    dedupeCandidates: () => missing("dedupeCandidates"),
    visionProvider: { observe: async () => missing("observe") },
    observeAll: async () => missing("observeAll"),
    scoreCandidate: () => missing("scoreCandidate"),
    describeCampus: async () => missing("describeCampus"),
    getCachedProfile: async () => sampleProfile,
    saveProfile: async () => {},
    now: () => Date.now(),
    ...overrides,
  });

  it("serves /u/<qid> from the cache before loading entity details", async () => {
    const d = deps({});
    const events: StreamEvent[] = [];
    const input = { qid: sampleProfile.entity.qid, refresh: false, simulate: [], aiAllowed: true };
    await runProfilePipeline(input, d, (e) => events.push(e), signal());
    expect(events.map((e) => e.type)).toEqual(["resolved", "done"]);
    expect(events.at(-1)).toMatchObject({ cached: true, profile: { generatedAt: sampleProfile.generatedAt } });
    expect(d.getEntity).not.toHaveBeenCalled();
  });

  it("skips the cache on refresh=1", async () => {
    const getCached = vi.fn(async () => sampleProfile);
    const events: StreamEvent[] = [];
    const input = { qid: sampleProfile.entity.qid, refresh: true, simulate: [], aiAllowed: true };
    await runProfilePipeline(input, deps({ getCachedProfile: getCached }), (e) => events.push(e), signal());
    expect(getCached).not.toHaveBeenCalled();
    expect(events.some((e) => e.type === "done" && e.cached)).toBe(false);
  });
});
