import { afterEach, describe, expect, it, vi } from "vitest";
import { sampleProfile } from "@/fixtures/profile.sample";
import { NotImplementedError } from "@/lib/notImplemented";
import type { PipelineDeps } from "@/lib/pipeline/deps";
import { runProfilePipeline } from "@/lib/pipeline/orchestrator";
import type { StreamEvent, UniversityEntity } from "@/lib/types";

afterEach(() => {
  vi.doUnmock("@/lib/cache/kv");
  vi.doUnmock("@upstash/ratelimit");
  vi.resetModules();
});

/** Loads lib/cache/ratelimit.ts with a fake Upstash limiter: `results[prefix]` decides each limit() call. */
async function loadWithLimiter(results: Record<string, () => { success: boolean }>, redis: object | null = {}) {
  vi.resetModules();
  vi.doMock("@/lib/cache/kv", () => ({ getRedis: () => redis, kvGet: async () => null, kvSet: async () => {} }));
  vi.doMock("@upstash/ratelimit", () => ({
    Ratelimit: class {
      static slidingWindow = (tokens: number, window: string) => ({ tokens, window });
      static fixedWindow = (tokens: number, window: string) => ({ tokens, window });
      prefix: string;
      constructor(config: { prefix: string }) {
        this.prefix = config.prefix;
      }
      limit = async () => results[this.prefix]();
    },
  }));
  return import("@/lib/cache/ratelimit");
}

describe("allowFreshRun", () => {
  it("allows everything when Redis is not configured", async () => {
    const { allowFreshRun } = await loadWithLimiter({}, null);
    expect(await allowFreshRun("client")).toEqual({ allowed: true });
  });

  it("blocks a client over FRESH_RUNS_PER_CLIENT fresh runs per 10 minutes with an honest reason", async () => {
    const daily = vi.fn(() => ({ success: true }));
    const { allowFreshRun, RATE_LIMITED_MESSAGE } = await loadWithLimiter({
      "rl:fresh:client": () => ({ success: false }),
      "rl:fresh:daily": daily,
    });
    expect(await allowFreshRun("client")).toEqual({ allowed: false, reason: RATE_LIMITED_MESSAGE });
    expect(daily).not.toHaveBeenCalled(); // a blocked client does not spend the daily budget
  });

  it("blocks everyone past the daily budget", async () => {
    const { allowFreshRun, DAILY_BUDGET_MESSAGE } = await loadWithLimiter({
      "rl:fresh:client": () => ({ success: true }),
      "rl:fresh:daily": () => ({ success: false }),
    });
    expect(await allowFreshRun("client")).toEqual({ allowed: false, reason: DAILY_BUDGET_MESSAGE });
  });

  it("fails open when Redis errors", async () => {
    const { allowFreshRun } = await loadWithLimiter({
      "rl:fresh:client": () => {
        throw new Error("redis down");
      },
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await allowFreshRun("client")).toEqual({ allowed: true });
  });

  it("keys clients by a hash of the first forwarded IP", async () => {
    const { clientKeyFromHeaders } = await loadWithLimiter({}, null);
    const key = clientKeyFromHeaders(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }));
    expect(key).toMatch(/^[0-9a-f]{32}$/);
    expect(key).not.toContain("203");
    expect(clientKeyFromHeaders(new Headers({ "x-real-ip": "203.0.113.7" }))).toBe(key);
  });
});

describe("orchestrator gate before fresh runs", () => {
  const entity: UniversityEntity = { ...sampleProfile.entity };
  const missing = (what: string): never => {
    throw new NotImplementedError(what, "PX", 0);
  };
  const deps = (overrides: Partial<PipelineDeps>): PipelineDeps => ({
    resolveQuery: async () => ({ status: "resolved", entity }),
    getEntity: async () => missing("getEntity"),
    getSummaries: async () => missing("getSummaries"),
    gatherCommons: vi.fn(async () => missing("gatherCommons")),
    gatherWebSearch: async () => missing("gatherWebSearch"),
    gatherOpenverse: async () => missing("gatherOpenverse"),
    fetchCandidates: async () => missing("fetchCandidates"),
    dedupeCandidates: () => missing("dedupeCandidates"),
    visionProvider: { observe: async () => missing("observe") },
    observeAll: async () => missing("observeAll"),
    scoreCandidate: () => missing("scoreCandidate"),
    describeCampus: async () => missing("describeCampus"),
    getCachedProfile: async () => null,
    saveProfile: async () => {},
    now: () => Date.now(),
    ...overrides,
  });
  const run = async (d: PipelineDeps, refresh = false) => {
    const events: StreamEvent[] = [];
    await runProfilePipeline(
      { query: "x", refresh, simulate: [], aiAllowed: true },
      d,
      (e) => events.push(e),
      new AbortController().signal,
    );
    return events;
  };
  const blocked = async () => ({ allowed: false, reason: "Лимит" });

  it("stops a fresh run over the limit with an honest message and no source calls", async () => {
    const d = deps({ beforeFreshRun: blocked });
    const events = await run(d);
    expect(events).toEqual([{ type: "error", code: "rate_limited", message: "Лимит", retryable: true }]);
    expect(d.gatherCommons).not.toHaveBeenCalled();
  });

  it("serves the saved profile instead of a limited refresh", async () => {
    const events = await run(deps({ beforeFreshRun: blocked, getCachedProfile: async () => sampleProfile }), true);
    expect(events.map((e) => e.type)).toEqual(["resolved", "done"]);
    expect(events.at(-1)).toMatchObject({ cached: true });
  });

  it("never limits cached views", async () => {
    const gate = vi.fn(blocked);
    await run(deps({ beforeFreshRun: gate, getCachedProfile: async () => sampleProfile }));
    expect(gate).not.toHaveBeenCalled();
  });

  it("runs normally when allowed", async () => {
    const events = await run(deps({ beforeFreshRun: async () => ({ allowed: true }) }));
    expect(events.at(-1)).toMatchObject({ type: "done", cached: false });
  });
});
