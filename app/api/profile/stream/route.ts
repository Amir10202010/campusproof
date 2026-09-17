import type { NextRequest } from "next/server";
import { LIMITS } from "@/lib/config/limits";
import { parseSimulate } from "@/lib/pipeline/context";
import { createDefaultDeps } from "@/lib/pipeline/deps";
import { eventStreamResponse } from "@/lib/pipeline/events";
import { runProfilePipeline } from "@/lib/pipeline/orchestrator";
import { freeAiAllowedFor } from "@/lib/pipeline/regions";
import type { PipelineInput } from "@/lib/types";

export const maxDuration = 60;

const QID = /^Q\d{1,12}$/;

/**
 * GET /api/profile/stream?q=... | ?qid=Q123  (&refresh=1, &simulate=web_search_down,vision_down,wikimedia_down)
 * Streams StreamEvent objects (lib/types.ts) as Server-Sent Events. Owner: P1 · issue #10.
 * The route is final; the pipeline lives in lib/pipeline/orchestrator.ts.
 * TODO(P1 #13): call allowFreshRun() from lib/cache/ratelimit.ts before running a fresh (non-cached) profile.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const qidParam = params.get("qid");
  const input: PipelineInput = {
    query: params.get("q")?.trim().slice(0, LIMITS.QUERY_MAX_LENGTH) || undefined,
    qid: qidParam && QID.test(qidParam) ? qidParam : undefined,
    refresh: params.get("refresh") === "1",
    simulate: parseSimulate(params.get("simulate")),
    aiAllowed: freeAiAllowedFor(request.headers.get("x-vercel-ip-country")),
  };

  if (!input.query && !input.qid) {
    return eventStreamResponse(async (emit) => {
      emit({ type: "error", code: "bad_request", message: "Укажите название университета", retryable: false });
    });
  }

  const deps = createDefaultDeps();
  return eventStreamResponse(async (emit, signal) => {
    await runProfilePipeline(input, deps, emit, signal);
  }, request.signal);
}
