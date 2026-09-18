import { describe, expect, it, vi } from "vitest";
import { sampleProfile } from "@/fixtures/profile.sample";
import { NotImplementedError } from "@/lib/notImplemented";
import { TimeoutError } from "@/lib/pipeline/deadline";
import type { PipelineDeps } from "@/lib/pipeline/deps";
import { runProfilePipeline } from "@/lib/pipeline/orchestrator";
import { visionFailureReason, visionSkippedReason } from "@/lib/pipeline/reasons";
import type { Candidate, FetchedCandidate, SourceStatus, StreamEvent, VisionObservation } from "@/lib/types";

describe("reasons shown instead of a silent degraded profile", () => {
  it("explains why the visual check failed", () => {
    expect(visionFailureReason(new Error('{"error":{"code":429,"status":"RESOURCE_EXHAUSTED"}}'))).toBe(
      "Исчерпана бесплатная квота Gemini",
    );
    expect(visionFailureReason(new Error('{"error":{"code":401,"status":"UNAUTHENTICATED"}}'))).toBe(
      "Gemini не принял ключ (проверьте GEMINI_API_KEY)",
    );
    expect(visionFailureReason(new TimeoutError("vision", 1000))).toBe("Модель не ответила к дедлайну");
    expect(visionFailureReason(new NotImplementedError("observeAll", "P2", 18))).toBe(
      "Визуальная проверка не подключена",
    );
    expect(visionFailureReason(new Error("socket hang up"))).toBe("Ошибка визуальной проверки");
  });

  it("explains why it did not run at all", () => {
    const input = { refresh: false, simulate: [], aiAllowed: true } as const;
    expect(visionSkippedReason({ ...input, aiAllowed: false }, 5000)).toMatch(/ЕЭЗ/);
    expect(visionSkippedReason({ ...input, simulate: ["vision_down"] }, 5000)).toMatch(/Симуляция/);
    expect(visionSkippedReason(input, 0)).toMatch(/дедлайна/);
  });
});

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
const missing = (what: string): never => {
  throw new NotImplementedError(what, "PX", 0);
};

function deps(overrides: Partial<PipelineDeps>): PipelineDeps {
  return {
    resolveQuery: async () => ({ status: "resolved", entity: sampleProfile.entity }),
    getEntity: async () => missing("getEntity"),
    getSummaries: async () => [],
    gatherCommons: async () => ({ candidates: [candidate], subcategories: [] }),
    gatherWebSearch: async () => missing("gatherWebSearch"),
    gatherOpenverse: async () => missing("gatherOpenverse"),
    fetchCandidates: async () => ({ fetched: [fetched], failed: [] }),
    dedupeCandidates: (items) => ({ kept: items, rejected: [] }),
    visionProvider: { observe: async () => [] },
    observeAll: async () => new Map(),
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
    ...overrides,
  };
}

async function visionStatusOf(d: PipelineDeps, aiAllowed = true): Promise<SourceStatus | undefined> {
  const events: StreamEvent[] = [];
  await runProfilePipeline(
    { query: "x", refresh: false, simulate: [], aiAllowed },
    d,
    (event) => events.push(event),
    new AbortController().signal,
  );
  return events.flatMap((e) => (e.type === "source" && e.status.source === "vision" ? [e.status] : []))[0];
}

describe("the visual check reports itself like a source", () => {
  it("ok with the number of checked images", async () => {
    const observations = new Map<string, VisionObservation>([["a", { id: "a" } as VisionObservation]]);
    expect(await visionStatusOf(deps({ observeAll: async () => observations }))).toMatchObject({
      status: "ok",
      candidates: 1,
    });
  });

  it("error with a plain reason when the model rejects the key", async () => {
    const status = await visionStatusOf(
      deps({
        observeAll: async () => {
          throw new Error('{"error":{"code":401,"status":"UNAUTHENTICATED"}}');
        },
      }),
    );
    expect(status).toMatchObject({ status: "error", note: "Gemini не принял ключ (проверьте GEMINI_API_KEY)" });
  });

  it("skipped with the region reason for EEA visitors", async () => {
    const observeAll = vi.fn(async () => new Map());
    const status = await visionStatusOf(deps({ observeAll }), false);
    expect(observeAll).not.toHaveBeenCalled();
    expect(status).toMatchObject({ status: "skipped", note: expect.stringContaining("ЕЭЗ") });
  });
});
