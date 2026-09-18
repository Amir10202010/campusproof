import { afterEach, describe, expect, it, vi } from "vitest";
import recorded from "@/tests/data/commons.json";
import { gatherCommons } from "@/lib/sources/commons";
import type { RunContext, UniversityEntity } from "@/lib/types";

/** Real recorded responses (Nazarbayev University); one query is made to hang to hit the stage deadline. */
const nu = recorded.entities.Q2783344 as unknown as UniversityEntity;
const responses = recorded.responses as Record<string, unknown>;

function replayWithHang(hangPattern: string) {
  vi.stubGlobal("fetch", async (input: string | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes(hangPattern)) {
      // Never answers: only the abort signal ends it, exactly like a slow Commons query.
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
      });
    }
    const body = responses[url];
    return body ? Response.json(body) : new Response("not recorded", { status: 404 });
  });
}

const ctxWithDeadline = (ms: number): RunContext => ({
  requestId: "test",
  startedAt: Date.now(),
  deadlineAt: Date.now() + ms,
  signal: new AbortController().signal,
  simulate: [],
  lang: "ru",
});

afterEach(() => vi.unstubAllGlobals());

describe("commons keeps what it collected when a query is too slow (#85)", () => {
  it("returns partial candidates instead of nothing", async () => {
    replayWithHang("generator=geosearch");
    const started = Date.now();
    const result = await gatherCommons(nu, ctxWithDeadline(1_200));
    expect(result.partial).toBe(true);
    expect(result.candidates.length).toBeGreaterThan(10);
    expect(Date.now() - started).toBeLessThan(1_200);
  });

  it("is not partial when every query answers", async () => {
    replayWithHang("never-matches-anything");
    const result = await gatherCommons(nu, ctxWithDeadline(10_000));
    expect(result.partial).toBe(false);
    expect(result.candidates.length).toBeGreaterThan(20);
  });
});
