import { describe, expect, it, vi } from "vitest";
import { sampleProfile } from "@/fixtures/profile.sample";
import { fetchSavedProfile } from "@/lib/client/profileStream";
import { LIMITS } from "@/lib/config/limits";
import { NotImplementedError } from "@/lib/notImplemented";
import type { PipelineDeps } from "@/lib/pipeline/deps";
import { runProfilePipeline } from "@/lib/pipeline/orchestrator";
import type { Candidate, FetchedCandidate, RunContext } from "@/lib/types";

const missing = (what: string): never => {
  throw new NotImplementedError(what, "PX", 0);
};

const candidate: Candidate = {
  imageUrl: "https://img.test/a.jpg",
  sourcePageUrl: "https://test.edu/a",
  sourceDomain: "test.edu",
  provider: "commons",
  provenance: { sourceType: "encyclopedic" },
};
const fetched: FetchedCandidate = {
  ...candidate,
  id: "a",
  canonicalUrl: candidate.imageUrl,
  prepared: { jpeg: Buffer.alloc(0), width: 800, height: 600, dHash: "0000000000000000" },
  lowRes: false,
  alsoFoundAt: [],
};

describe("stage budgets", () => {
  it("gives fetch and vision their own deadlines inside the global one", async () => {
    let fetchCtx: RunContext | undefined;
    let visionCtx: RunContext | undefined;
    const deps: PipelineDeps = {
      resolveQuery: async () => ({ status: "resolved", entity: sampleProfile.entity }),
      getEntity: async () => missing("getEntity"),
      getSummaries: async () => [],
      gatherCommons: async () => ({ candidates: [candidate], subcategories: [] }),
      gatherWebSearch: async () => missing("gatherWebSearch"),
      gatherOpenverse: async () => missing("gatherOpenverse"),
      fetchCandidates: async (_items, ctx) => {
        fetchCtx = ctx;
        return { fetched: [fetched], failed: [] };
      },
      dedupeCandidates: (items) => ({ kept: items, rejected: [] }),
      visionProvider: { observe: async () => [] },
      observeAll: vi.fn(async (_items, _context, _provider, ctx) => {
        visionCtx = ctx;
        return new Map();
      }),
      scoreCandidate: () => ({
        points: 70,
        tier: "verified",
        category: "campus",
        secondary: [],
        evidence: [],
        labels: [],
      }),
      describeCampus: async () => null,
      getCachedProfile: async () => null,
      saveProfile: async () => {},
      now: () => Date.now(),
    };
    const started = Date.now();
    const profile = await runProfilePipeline(
      { query: "x", refresh: false, simulate: [], aiAllowed: true },
      deps,
      () => {},
      new AbortController().signal,
    );
    expect(profile?.photos).toHaveLength(1);
    expect(fetchCtx?.deadlineAt).toBeLessThanOrEqual(Date.now() + LIMITS.FETCH_STAGE_TIMEOUT_MS);
    expect(fetchCtx?.deadlineAt).toBeGreaterThan(started);
    const globalDeadline = (visionCtx as RunContext).startedAt + LIMITS.GLOBAL_DEADLINE_MS;
    expect(visionCtx?.deadlineAt).toBeLessThanOrEqual(globalDeadline - LIMITS.ASSEMBLE_RESERVE_MS);
    expect(fetchCtx?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("fetchSavedProfile (stream fallback)", () => {
  it("returns the saved profile for the same qid", async () => {
    const fetchImpl = vi.fn(async () => Response.json(sampleProfile));
    expect(await fetchSavedProfile(sampleProfile.entity.qid, fetchImpl)).toEqual(sampleProfile);
    expect(fetchImpl).toHaveBeenCalledWith(`/api/profile/${sampleProfile.entity.qid}`, expect.anything());
  });

  it("returns null when nothing is saved, the id differs or the network fails", async () => {
    expect(
      await fetchSavedProfile("Q1", async () => Response.json({ error: "not_cached" }, { status: 404 })),
    ).toBeNull();
    expect(await fetchSavedProfile("Q1", async () => Response.json(sampleProfile))).toBeNull();
    expect(
      await fetchSavedProfile("Q1", async () => {
        throw new TypeError("offline");
      }),
    ).toBeNull();
  });
});
