import { describe, expect, it, vi } from "vitest";
import { sampleProfile } from "@/fixtures/profile.sample";
import { NotImplementedError } from "@/lib/notImplemented";
import type { PipelineDeps } from "@/lib/pipeline/deps";
import { runProfilePipeline } from "@/lib/pipeline/orchestrator";
import type { FetchedCandidate, PipelineInput, StreamEvent, UniversityEntity } from "@/lib/types";

const entity: UniversityEntity = {
  qid: "Q1",
  name: "Test University",
  names: { en: "Test University" },
  aliases: [],
  country: "Kazakhstan",
  countryCode: "KZ",
  coords: { lat: 51.09, lon: 71.4 },
  city: { name: "Astana", lat: 51.16, lon: 71.47 },
  domains: ["test.edu"],
  wikipedia: [],
};

const missing = (what: string): never => {
  throw new NotImplementedError(what, "PX", 0);
};

/** Every lane "not implemented" by default — exactly the state of the repo on day one. */
function deps(overrides: Partial<PipelineDeps> = {}): PipelineDeps {
  return {
    resolveQuery: async () => missing("resolveQuery"),
    getEntity: async () => missing("getEntity"),
    getSummaries: async () => missing("getSummaries"),
    gatherCommons: async () => missing("gatherCommons"),
    gatherWebSearch: async () => missing("gatherWebSearch"),
    fetchCandidates: async () => missing("fetchCandidates"),
    dedupeCandidates: () => missing("dedupeCandidates"),
    visionProvider: { observe: async () => missing("observe") },
    observeAll: async () => missing("observeAll"),
    scoreCandidate: () => missing("scoreCandidate"),
    describeCampus: async () => missing("describeCampus"),
    getCachedProfile: async () => missing("getCachedProfile"),
    saveProfile: async () => missing("saveProfile"),
    now: () => Date.now(),
    ...overrides,
  };
}

function fetched(id: string, overrides: Partial<FetchedCandidate> = {}): FetchedCandidate {
  return {
    id,
    canonicalUrl: `https://img.test/${id}.jpg`,
    imageUrl: `https://img.test/${id}.jpg`,
    sourcePageUrl: `https://test.edu/${id}`,
    sourceDomain: "test.edu",
    provider: "commons",
    provenance: { sourceType: "official" },
    prepared: { jpeg: Buffer.alloc(0), width: 800, height: 600, dHash: "0000000000000000" },
    lowRes: false,
    alsoFoundAt: [],
    ...overrides,
  };
}

async function run(d: PipelineDeps, input: Partial<PipelineInput> = {}) {
  const events: StreamEvent[] = [];
  const profile = await runProfilePipeline(
    { query: "test", refresh: false, simulate: [], ...input },
    d,
    (event) => events.push(event),
    new AbortController().signal,
  );
  return { events, profile, types: events.map((e) => e.type) };
}

describe("pipeline walking skeleton", () => {
  it("reports not_implemented honestly when the resolver is missing", async () => {
    const { events, profile } = await run(deps());
    expect(profile).toBeNull();
    expect(events).toEqual([expect.objectContaining({ type: "error", code: "not_implemented" })]);
  });

  it("stops at the pick-list for ambiguous queries", async () => {
    const { types, profile } = await run(
      deps({ resolveQuery: async () => ({ status: "ambiguous", query: "MSU", candidates: [] }) }),
    );
    expect(profile).toBeNull();
    expect(types).toEqual(["ambiguous"]);
  });

  it("runs end-to-end with unimplemented lanes marked as skipped and no fake photos", async () => {
    const { events, profile } = await run(deps({ resolveQuery: async () => ({ status: "resolved", entity }) }));
    expect(profile?.photos).toEqual([]);
    expect(profile?.degraded).toEqual([]);
    const sources = events.flatMap((e) => (e.type === "source" ? [e.status] : []));
    expect(sources.map((s) => s.status)).toEqual(["skipped", "skipped", "skipped"]);
    expect(events.at(-1)).toEqual(expect.objectContaining({ type: "done", cached: false }));
  });

  it("scores candidates, streams photos, sends rejects to the tray and skips caching degraded profiles", async () => {
    const saveProfile = vi.fn(async () => {});
    const { events, profile } = await run(
      deps({
        resolveQuery: async () => ({ status: "resolved", entity }),
        gatherCommons: async () => ({ candidates: [fetched("a"), fetched("b")], subcategories: [] }),
        fetchCandidates: async () => ({ fetched: [fetched("a"), fetched("b")], failed: [] }),
        dedupeCandidates: (items) => ({ kept: items, rejected: [] }),
        scoreCandidate: (candidate) =>
          candidate.id === "a"
            ? { points: 75, tier: "verified", category: "campus", secondary: [], evidence: [], labels: [] }
            : {
                points: 0,
                tier: "rejected",
                category: "campus",
                secondary: [],
                evidence: [],
                labels: [],
                reject: { reason: "stock_source", detail: "stock" },
              },
        saveProfile,
      }),
    );
    expect(events.some((e) => e.type === "photos" && e.photos.length === 1)).toBe(true);
    expect(profile?.photos.map((p) => p.id)).toEqual(["a"]);
    expect(profile?.rejected.map((r) => r.reason)).toEqual(["stock_source"]);
    expect(profile?.coverage.campus).toEqual({ verified: 1, likely: 0, unconfirmed: 0, status: "thin" });
    expect(profile?.degraded).toContain("vision_unavailable"); // observeAll not implemented
    expect(saveProfile).not.toHaveBeenCalled();
    expect(profile?.distanceToCityCenterM).toBeGreaterThan(5_000);
  });

  it("simulates a web search outage without failing the profile", async () => {
    const { events, profile } = await run(deps({ resolveQuery: async () => ({ status: "resolved", entity }) }), {
      simulate: ["web_search_down"],
    });
    const web = events.find((e) => e.type === "source" && e.status.source === "web_search");
    expect(web).toEqual(expect.objectContaining({ status: expect.objectContaining({ status: "simulated_down" }) }));
    expect(profile?.degraded).toContain("web_search_unavailable");
  });

  it("serves a cached profile immediately", async () => {
    const { types, events } = await run(
      deps({
        resolveQuery: async () => ({ status: "resolved", entity }),
        getCachedProfile: async () => sampleProfile,
      }),
    );
    expect(types).toEqual(["resolved", "done"]);
    expect(events.at(-1)).toEqual(expect.objectContaining({ cached: true }));
  });
});
